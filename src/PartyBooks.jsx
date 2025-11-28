import React, { useEffect, useMemo, useState } from "react";
import { auth, db } from "./firebase";
import { collection, query, where, onSnapshot, getDoc, doc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const PartyBooks = () => {
  const [companyId, setCompanyId] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [partyFilter, setPartyFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userDoc = await getDoc(doc(db, "users", u.uid));
        const compId = userDoc.data()?.companyId || "";
        setCompanyId(compId);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!companyId) return;
    const txQuery = query(collection(db, "bankbooks"), where("companyId", "==", companyId));
    const unsub = onSnapshot(txQuery, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(tx => tx.accountType === "party");
      setTransactions(list);
    });
    return () => unsub();
  }, [companyId]);

  const toMillis = (stamp) => {
    if (!stamp) return 0;
    if (typeof stamp.toMillis === "function") return stamp.toMillis();
    if (typeof stamp.toDate === "function") {
      const dateObj = stamp.toDate();
      return dateObj instanceof Date ? dateObj.getTime() : 0;
    }
    if (typeof stamp.seconds === "number") return stamp.seconds * 1000;
    return 0;
  };

  const uniqueParties = useMemo(() => {
    return Array.from(new Set(transactions.map(tx => tx.accountName).filter(Boolean)));
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    let list = partyFilter === "all" ? transactions : transactions.filter(tx => tx.accountName === partyFilter);
    list = list.filter(tx => {
      const dateVal = tx.date?.toDate?.();
      if (!dateVal) return true;
      if (startDate) {
        const from = new Date(startDate);
        from.setHours(0, 0, 0, 0);
        if (dateVal < from) return false;
      }
      if (endDate) {
        const to = new Date(endDate);
        to.setHours(23, 59, 59, 999);
        if (dateVal > to) return false;
      }
      return true;
    });
    list.sort((a, b) => toMillis(a.date) - toMillis(b.date));
    return list;
  }, [transactions, partyFilter, startDate, endDate]);

  const getReceipt = (tx) => (tx.type?.includes("receipt") ? tx.amount : "");
  const getPayment = (tx) => (tx.type?.includes("payment") ? tx.amount : "");

  return (
    <div className="table-card full-span">
      <div className="table-card__header">
        <div>
          <p className="eyebrow">Customers & Vendors</p>
          <h3>Party Books</h3>
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <div className="filter-select">
            <label>From</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="filter-select">
            <label>To</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          {uniqueParties.length > 0 && (
            <div className="filter-select">
              <label>Party</label>
              <select value={partyFilter} onChange={(e) => setPartyFilter(e.target.value)}>
                <option value="all">All Parties</option>
                {uniqueParties.map((party) => (
                  <option key={party} value={party}>{party}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
      {loading && <p>Loading...</p>}
      {!loading && !companyId && <p className="text-muted">No company assigned.</p>}
      {!loading && companyId && transactions.length === 0 && (
        <p className="text-muted">No party transactions recorded yet.</p>
      )}
      {transactions.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Party</th>
              <th>Receipt</th>
              <th>Payment</th>
              <th>Bank/Cash Book</th>
              <th>Details</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let runningBalance = 0;
              return sortedTransactions.map(tx => {
                const receipt = getReceipt(tx);
                const payment = getPayment(tx);
                if (receipt) {
                  runningBalance += Number(receipt);
                } else if (payment) {
                  runningBalance -= Number(payment);
                }
                return (
                  <tr key={tx.id}>
                    <td>{tx.date?.toDate().toLocaleDateString?.()}</td>
                    <td>{tx.accountName || "-"}</td>
                    <td>{receipt || "-"}</td>
                    <td>{payment || "-"}</td>
                    <td>{tx.bankName}</td>
                    <td>{tx.details || "-"}</td>
                    <td>{runningBalance.toFixed(2)}</td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default PartyBooks;

