import React, { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { collection, addDoc, query, where, getDocs, Timestamp, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const TYPE_CONFIG = [
  { key: "bank", label: "Bank", collection: "banks" },
  { key: "party", label: "Party (Receivable/Payable)", collection: "parties" },
  { key: "expense", label: "Expense", collection: "expenses" },
  { key: "income", label: "Income", collection: "income" },
];

function MasterDataManager() {
  const [companyId, setCompanyId] = useState("");
  const [activeType, setActiveType] = useState(TYPE_CONFIG[0].key);
  const [name, setName] = useState("");
  const [items, setItems] = useState([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userDoc = await getDoc(doc(db, "users", u.uid));
        const userData = userDoc.data();
        setCompanyId(userData?.companyId || "");
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!companyId) return;
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, activeType]);

  const fetchItems = async () => {
    if (!companyId) return;
    const config = TYPE_CONFIG.find((t) => t.key === activeType);
    const q = query(collection(db, config.collection), where("companyId", "==", companyId));
    const snapshot = await getDocs(q);
    setItems(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!companyId) return alert("No company assigned!");
    if (!name.trim()) return alert("Enter a name.");
    const config = TYPE_CONFIG.find((t) => t.key === activeType);
    await addDoc(collection(db, config.collection), {
      companyId,
      name: name.trim(),
      createdAt: Timestamp.now(),
    });
    setName("");
    fetchItems();
  };

  return (
    <div>
      <h2>Quick Masters</h2>
      <form onSubmit={handleCreate}>
        <select value={activeType} onChange={(e) => setActiveType(e.target.value)}>
          {TYPE_CONFIG.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
        <input placeholder={`New ${TYPE_CONFIG.find(t => t.key === activeType)?.label}`} value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit">Create</button>
      </form>
      <div>
        <h4>{TYPE_CONFIG.find((t) => t.key === activeType)?.label} List</h4>
        <ul>
          {items.map((item) => (
            <li key={item.id}>{item.name}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default MasterDataManager;




