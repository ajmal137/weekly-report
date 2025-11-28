import React, { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

function DatewiseReport() {
  const [companyId, setCompanyId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [bankTrans, setBankTrans] = useState([]);
  const [payables, setPayables] = useState([]);
  const [receivables, setReceivables] = useState([]);

  useEffect(() => {
    onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userQuery = query(collection(db, "users"), where("email", "==", u.email));
        const userSnap = await getDocs(userQuery);
        const userData = userSnap.docs[0]?.data();
        setCompanyId(userData?.companyId || "");
      }
    });
    // eslint-disable-next-line
  }, []);

  const fetchAll = async () => {
    if (!companyId || !dateFrom || !dateTo) return;
    const from = Timestamp.fromDate(new Date(dateFrom));
    const to = Timestamp.fromDate(new Date(dateTo));
    // Bank
    const bq = query(collection(db, "bankbooks"), where("companyId", "==", companyId), where("date", ">=", from), where("date", "<=", to));
    const bankSnap = await getDocs(bq);
    setBankTrans(bankSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    // Payables
    const pq = query(collection(db, "payables"), where("companyId", "==", companyId), where("date", ">=", from), where("date", "<=", to));
    const paySnap = await getDocs(pq);
    setPayables(paySnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    // Receivables
    const rq = query(collection(db, "receivables"), where("companyId", "==", companyId), where("date", ">=", from), where("date", "<=", to));
    const recSnap = await getDocs(rq);
    setReceivables(recSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const getSignedAmount = (tran) => {
    if (!tran?.amount) return 0;
    return tran.type?.includes("receipt") ? tran.amount : -tran.amount;
  };

  return (
    <div>
      <h2>Datewise Reports</h2>
      <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/> to <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/>
      <button onClick={fetchAll}>Fetch</button>
      <h3>Bank/Cash Transactions</h3>
      <table border="1"><thead><tr><th>Date</th><th>Type</th><th>Receipt</th><th>Payment</th><th>Bank</th><th>Account</th><th>Balance</th></tr></thead><tbody>
        {(() => {
          let runningBalance = 0;
          return bankTrans.map(tran => {
            runningBalance += getSignedAmount(tran);
            return (
              <tr key={tran.id}>
                <td>{tran.date?.toDate().toLocaleDateString?.()}</td>
                <td>{tran.type}</td>
                <td>{tran.type?.includes("receipt") ? tran.amount : ""}</td>
                <td>{tran.type?.includes("payment") ? tran.amount : ""}</td>
                <td>{tran.bankName}</td>
                <td>{tran.accountName || "-"}</td>
                <td>{runningBalance.toFixed(2)}</td>
              </tr>
            );
          });
        })()}
      </tbody></table>
      <h3>Payables</h3>
      <table border="1"><thead><tr><th>Date</th><th>To</th><th>Amount</th><th>Due Date</th><th>Paid?</th></tr></thead><tbody>
        {payables.map(p => (
          <tr key={p.id}>
            <td>{p.date?.toDate().toLocaleDateString?.()}</td>
            <td>{p.to}</td><td>{p.amount}</td><td>{p.dueDate}</td><td>{p.paid ? "Yes" : "No"}</td>
          </tr>
        ))}
      </tbody></table>
      <h3>Receivables</h3>
      <table border="1"><thead><tr><th>Date</th><th>From</th><th>Amount</th><th>Due Date</th><th>Received?</th></tr></thead><tbody>
        {receivables.map(r => (
          <tr key={r.id}>
            <td>{r.date?.toDate().toLocaleDateString?.()}</td>
            <td>{r.from}</td><td>{r.amount}</td><td>{r.dueDate}</td><td>{r.received ? "Yes" : "No"}</td>
          </tr>
        ))}
      </tbody></table>
    </div>
  );
}
export default DatewiseReport;
