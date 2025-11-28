import React, { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { collection, addDoc, query, where, getDocs, Timestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

function PayablesReceivables({ showForms = true, filter = "all" }) {
  const [companyId, setCompanyId] = useState("");
  const [payables, setPayables] = useState([]);
  const [receivables, setReceivables] = useState([]);
  const [partyFilter, setPartyFilter] = useState("all");

  // Form state for payable
  const [pAmount, setPAmount] = useState("");
  const [pTo, setPTo] = useState("");
  const [pDueDate, setPDueDate] = useState("");

  // Form state for receivable
  const [rAmount, setRAmount] = useState("");
  const [rFrom, setRFrom] = useState("");
  const [rDueDate, setRDueDate] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userDoc = await getDocs(query(collection(db, "users"), where("email", "==", u.email)));
        const userData = userDoc.docs[0]?.data();
        setCompanyId(userData?.companyId || "");
        if (userData?.companyId) {
          fetchPayables(userData.companyId);
          fetchReceivables(userData.companyId);
        }
      }
    });
    return () => unsub();
    // eslint-disable-next-line
  }, []);

  const fetchPayables = async (compId) => {
    const q = query(collection(db, "payables"), where("companyId", "==", compId));
    const snap = await getDocs(q);
    setPayables(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const fetchReceivables = async (compId) => {
    const q = query(collection(db, "receivables"), where("companyId", "==", compId));
    const snap = await getDocs(q);
    setReceivables(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const handleAddPayable = async (e) => {
    e.preventDefault();
    if(!companyId) return alert("No company assigned!");
    await addDoc(collection(db, "payables"), {
      companyId,
      amount: parseFloat(pAmount),
      to: pTo,
      dueDate: pDueDate,
      paid: false,
      date: Timestamp.now(),
    });
    setPAmount("");setPTo("");setPDueDate("");
    fetchPayables(companyId);
  };

  const handleAddReceivable = async (e) => {
    e.preventDefault();
    if(!companyId) return alert("No company assigned!");
    await addDoc(collection(db, "receivables"), {
      companyId,
      amount: parseFloat(rAmount),
      from: rFrom,
      dueDate: rDueDate,
      received: false,
      date: Timestamp.now(),
    });
    setRAmount("");setRFrom("");setRDueDate("");
    fetchReceivables(companyId);
  };

  const uniqueParties = Array.from(
    new Set([
      ...payables.map(p => p.to).filter(Boolean),
      ...receivables.map(r => r.from).filter(Boolean),
    ])
  );

  const filteredPayables = partyFilter === "all" ? payables : payables.filter(p => p.to === partyFilter);
  const filteredReceivables = partyFilter === "all" ? receivables : receivables.filter(r => r.from === partyFilter);

  return (
    <div>
      {(filter === "all") && uniqueParties.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <label>
            Filter by Party:&nbsp;
            <select value={partyFilter} onChange={(e) => setPartyFilter(e.target.value)}>
              <option value="all">All Parties</option>
              {uniqueParties.map((party) => (
                <option key={party} value={party}>{party}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      {(filter === "all" || filter === "payables") && (
        <>
          <h2>Payables</h2>
          {showForms && (
            <form onSubmit={handleAddPayable}>
              <input placeholder="Amount" value={pAmount} onChange={e=>setPAmount(e.target.value)} />
              <input placeholder="To" value={pTo} onChange={e=>setPTo(e.target.value)} />
              <input type="date" value={pDueDate} onChange={e=>setPDueDate(e.target.value)} />
              <button type="submit">Add Payable</button>
            </form>
          )}
          <table border="1">
            <thead><tr><th>Date</th><th>To</th><th>Amount</th><th>Due Date</th><th>Paid?</th></tr></thead>
            <tbody>
              {filteredPayables.map(p => (
                <tr key={p.id}>
                  <td>{p.date?.toDate().toLocaleDateString?.()}</td>
                  <td>{p.to}</td>
                  <td>{p.amount}</td>
                  <td>{p.dueDate}</td>
                  <td>{p.paid ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {(filter === "all" || filter === "receivables") && (
        <>
          <h2>Receivables</h2>
          {showForms && (
            <form onSubmit={handleAddReceivable}>
              <input placeholder="Amount" value={rAmount} onChange={e=>setRAmount(e.target.value)} />
              <input placeholder="From" value={rFrom} onChange={e=>setRFrom(e.target.value)} />
              <input type="date" value={rDueDate} onChange={e=>setRDueDate(e.target.value)} />
              <button type="submit">Add Receivable</button>
            </form>
          )}
          <table border="1">
            <thead><tr><th>Date</th><th>From</th><th>Amount</th><th>Due Date</th><th>Received?</th></tr></thead>
            <tbody>
              {filteredReceivables.map(r => (
                <tr key={r.id}>
                  <td>{r.date?.toDate().toLocaleDateString?.()}</td>
                  <td>{r.from}</td>
                  <td>{r.amount}</td>
                  <td>{r.dueDate}</td>
                  <td>{r.received ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
export default PayablesReceivables;
