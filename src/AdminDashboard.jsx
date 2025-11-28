import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, addDoc, getDocs, doc, updateDoc } from "firebase/firestore";

function AdminDashboard() {
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");

  useEffect(() => {
    // Fetch companies
    const fetchCompanies = async () => {
      const querySnapshot = await getDocs(collection(db, "companies"));
      setCompanies(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    // Fetch users
    const fetchUsers = async () => {
      const querySnapshot = await getDocs(collection(db, "users"));
      setUsers(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchCompanies();
    fetchUsers();
  }, []);

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    await addDoc(collection(db, "companies"), { name: newCompanyName });
    setNewCompanyName("");
    // Refresh company list
    const querySnapshot = await getDocs(collection(db, "companies"));
    setCompanies(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const handleAssignUser = async (e) => {
    e.preventDefault();
    if (!selectedCompany || !selectedUser) return;
    await updateDoc(doc(db, "users", selectedUser), { companyId: selectedCompany });
    setSelectedCompany("");
    setSelectedUser("");
    // Refresh user list
    const querySnapshot = await getDocs(collection(db, "users"));
    setUsers(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  return (
    <div>
      <h2>Admin Dashboard</h2>
      <form onSubmit={handleCreateCompany}>
        <input
          placeholder="New Company Name"
          value={newCompanyName}
          onChange={e => setNewCompanyName(e.target.value)}
        />
        <button type="submit">Create Company</button>
      </form>

      <h3>Companies:</h3>
      <ul>
        {companies.map(comp => (
          <li key={comp.id}>{comp.name}</li>
        ))}
      </ul>

      <h3>Users:</h3>
      <ul>
        {users.map(user => (
          <li key={user.id}>{user.email} ({user.role}) {user.companyId ? `- ${user.companyId}` : ''}</li>
        ))}
      </ul>

      <form onSubmit={handleAssignUser}>
        <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
          <option value="">Select User</option>
          {users.map(user => (
            <option value={user.id} key={user.id}>{user.email}</option>
          ))}
        </select>
        <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
          <option value="">Assign to Company</option>
          {companies.map(comp => (
            <option value={comp.id} key={comp.id}>{comp.name}</option>
          ))}
        </select>
        <button type="submit">Assign</button>
      </form>
    </div>
  );
}

export default AdminDashboard;
