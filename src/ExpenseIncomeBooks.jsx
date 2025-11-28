import React, { useEffect, useMemo, useState } from "react";
import { auth, db } from "./firebase";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const ExpenseIncomeBooks = () => {
  const [companyId, setCompanyId] = useState("");
  const [entries, setEntries] = useState([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const compId = userDoc.data()?.companyId || "";
        setCompanyId(compId);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!companyId) return;
    const txQuery = query(collection(db, "bankbooks"), where("companyId", "==", companyId));
    const unsub = onSnapshot(txQuery, (snap) => {
      const rows = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(row => row.accountType === "income" || row.accountType === "expense")
        .map(row => ({
          ...row,
          type: row.accountType,
          category: row.accountName,
          notes: row.details,
        }));
      setEntries(rows);
    });
    return () => unsub();
  }, [companyId]);

  const toDateValue = (stamp) => {
    if (!stamp || typeof stamp.toDate !== "function") return new Date(0);
    const dateObj = stamp.toDate();
    return dateObj instanceof Date ? dateObj : new Date(0);
  };

  const combinedRows = useMemo(() => {
    let rows = [...entries].sort((a, b) => {
      const aDate = toDateValue(a.date);
      const bDate = toDateValue(b.date);
      return aDate - bDate;
    });
    if (typeFilter !== "all") {
      rows = rows.filter(row => row.type === typeFilter);
    }
    if (categoryFilter !== "all") {
      rows = rows.filter(row => row.category === categoryFilter);
    }
    rows = rows.filter(row => {
      const dateObj = toDateValue(row.date);
      if (startDate) {
        const from = new Date(startDate);
        from.setHours(0, 0, 0, 0);
        if (dateObj < from) return false;
      }
      if (endDate) {
        const to = new Date(endDate);
        to.setHours(23, 59, 59, 999);
        if (dateObj > to) return false;
      }
      return true;
    });
    return rows;
  }, [entries, typeFilter, categoryFilter, startDate, endDate]);

  const categories = useMemo(() => {
    return Array.from(new Set(entries.map(row => row.category).filter(Boolean)));
  }, [entries]);

  const formatDate = (stamp) => {
    const dateObj = toDateValue(stamp);
    if (!dateObj || typeof dateObj.toLocaleDateString !== "function") return "-";
    return dateObj.toLocaleDateString();
  };

  return (
    <div className="table-card full-span">
      <div className="table-card__header">
        <div>
          <p className="eyebrow">Profitability</p>
          <h3>Expense / Income Books</h3>
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
          <div className="filter-select">
            <label>Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          {categories.length > 0 && (
            <div className="filter-select">
              <label>Category</label>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Category</th>
            <th>Amount</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {combinedRows.map(row => (
            <tr key={row.id}>
              <td>{formatDate(row.date)}</td>
              <td style={{ textTransform: "capitalize" }}>{row.type}</td>
              <td>{row.category || "-"}</td>
              <td>{row.amount}</td>
              <td>{row.notes || "-"}</td>
            </tr>
          ))}
          {combinedRows.length === 0 && (
            <tr>
              <td colSpan="5">No records yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ExpenseIncomeBooks;

