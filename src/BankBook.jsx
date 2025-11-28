import React, { useState, useEffect, useMemo, createContext, useContext } from "react";
import { auth, db } from "./firebase";
import { collection, addDoc, query, where, Timestamp, onSnapshot, doc, getDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const TYPE_SETS = {
  bank: ["bank_receipt", "bank_payment"],
  cash: ["cash_receipt", "cash_payment"],
  all: ["bank_receipt", "bank_payment", "cash_receipt", "cash_payment"],
};

export const CASH_ACCOUNTS = ["Cash", "Petty Cash"];

const CONTRA_LABELS = {
  "cash-bank": "Deposit",
  "bank-cash": "Withdrawal",
  "bank-bank": "Transfer",
};

const BankBookContext = createContext(null);

function useBankBookController({ mode = "all", showBalance = false, fixedBankName = null }) {
  const [transactions, setTransactions] = useState([]);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState(TYPE_SETS[mode]?.[0] || TYPE_SETS.all[0]);
  const [bankName, setBankName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [banks, setBanks] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [bankFilter, setBankFilter] = useState("all");
  const [cashFilter, setCashFilter] = useState("all");
  const [cashAccount, setCashAccount] = useState(CASH_ACCOUNTS[0]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const typeOptions = useMemo(() => TYPE_SETS[mode] || TYPE_SETS.all, [mode]);
  const baseTitle = useMemo(() => {
    if (mode === "bank") return "Bank Book";
    if (mode === "cash") return "Cash Book";
    return "Receipt/Payment Entry";
  }, [mode]);
  const showBankFilter = mode !== "cash" && !fixedBankName;
  const showCashFilter = mode === "cash" && !fixedBankName;

  useEffect(() => {
    if (!typeOptions.includes(type)) {
      setType(typeOptions[0]);
    }
  }, [typeOptions, type]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userDoc = await getDoc(doc(db, "users", u.uid));
        const userData = userDoc.data();
        setCompanyId(userData?.companyId || "");
      }
    });
    return () => unsub();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!companyId) return;
    const transQuery = query(collection(db, "bankbooks"), where("companyId", "==", companyId));
    const unsubTrans = onSnapshot(transQuery, (snap) => {
      setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const banksQuery = query(collection(db, "banks"), where("companyId", "==", companyId));
    const unsubBanks = onSnapshot(banksQuery, (snap) => {
      setBanks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const updateAccounts = (typeKey, snap) => {
      setAccounts(prev => {
        const filtered = prev.filter(acc => acc.type !== typeKey);
        const merged = snap.docs.map(doc => ({ id: doc.id, ...doc.data(), type: typeKey }));
        return [...filtered, ...merged];
      });
    };

    const partiesQuery = query(collection(db, "parties"), where("companyId", "==", companyId));
    const expensesQuery = query(collection(db, "expenses"), where("companyId", "==", companyId));
    const incomeQuery = query(collection(db, "income"), where("companyId", "==", companyId));

    const unsubParties = onSnapshot(partiesQuery, (snap) => updateAccounts("party", snap));
    const unsubExpenses = onSnapshot(expensesQuery, (snap) => updateAccounts("expense", snap));
    const unsubIncome = onSnapshot(incomeQuery, (snap) => updateAccounts("income", snap));

    return () => {
      unsubTrans();
      unsubBanks();
      unsubParties();
      unsubExpenses();
      unsubIncome();
    };
  }, [companyId]);

  useEffect(() => {
    if (!fixedBankName && bankFilter !== "all" && !banks.find(bank => bank.name === bankFilter)) {
      setBankFilter("all");
    }
  }, [banks, bankFilter, fixedBankName]);

  useEffect(() => {
    if (!showCashFilter && cashFilter !== "all") {
      setCashFilter("all");
    }
  }, [showCashFilter, cashFilter]);

  const filteredTransactions = useMemo(() => {
    let list = transactions;
    if (mode === "bank") {
      list = list.filter((tran) => tran.type?.startsWith("bank"));
    } else if (mode === "cash") {
      list = list.filter((tran) => tran.type?.startsWith("cash"));
    }
    if (fixedBankName) {
      list = list.filter((tran) => tran.bankName === fixedBankName);
    } else if (showBankFilter && bankFilter !== "all") {
      list = list.filter((tran) => tran.bankName === bankFilter);
    }
    if (showCashFilter && cashFilter !== "all") {
      list = list.filter((tran) => tran.bankName === cashFilter);
    }
    const matchesDateRange = (tran) => {
      const dateObj = tran.date?.toDate?.();
      if (!dateObj) return true;
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
    };
    list = list.filter(matchesDateRange);
    const sorted = [...list].sort((a, b) => {
      const aDate = a.date?.toDate?.() || a.date?.toDate?.() || new Date(0);
      const bDate = b.date?.toDate?.() || b.date?.toDate?.() || new Date(0);
      return aDate - bDate;
    });
    return sorted;
  }, [transactions, mode, bankFilter, fixedBankName, showBankFilter, showCashFilter, cashFilter, startDate, endDate]);

  const handleDelete = async (id, { skipConfirm = false } = {}) => {
    const confirmDelete = skipConfirm ? true : window.confirm("Delete this transaction?");
    if (!confirmDelete) return;
    setLoadingDelete(true);
    try {
      await deleteDoc(doc(db, "bankbooks", id));
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingDelete(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!companyId) return alert("No company assigned!");
    if (!transactionDate) return alert("Please select a transaction date.");
    const effectiveBankName = fixedBankName
      ? fixedBankName
      : type.includes("cash")
        ? cashAccount
        : bankName;
    if (!effectiveBankName) return alert("Select a bank.");
    if (!accountId) return alert("Select an account.");
    const selectedAccount = accounts.find(acc => acc.id === accountId);
    const payload = {
      companyId,
      amount: parseFloat(amount),
      type,
      bankName: effectiveBankName,
      accountId,
      accountName: selectedAccount?.name || "",
      accountType: selectedAccount?.type || "",
      date: Timestamp.fromDate(new Date(transactionDate)),
    };
    if (editingId) {
      await updateDoc(doc(db, "bankbooks", editingId), payload);
    } else {
      await addDoc(collection(db, "bankbooks"), payload);
    }
    setAmount("");
    setBankName("");
    setCashAccount(CASH_ACCOUNTS[0]);
    setAccountId("");
    setTransactionDate("");
    setEditingId(null);
  };

  const handleEdit = (tran) => {
    setEditingId(tran.id);
    setAmount(tran.amount.toString());
    setType(tran.type);
    if (tran.type.includes("cash")) {
      if (!fixedBankName) {
        setCashAccount(tran.bankName || CASH_ACCOUNTS[0]);
      }
    } else {
      setBankName(tran.bankName);
    }
    setAccountId(tran.accountId || "");
    setTransactionDate(tran.date?.toDate().toISOString().slice(0, 10) || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setAmount("");
    setBankName("");
    setCashAccount(CASH_ACCOUNTS[0]);
    setAccountId("");
    setTransactionDate("");
    setType("bank_receipt");
  };

  const getSignedAmount = (tran) => {
    if (!tran?.amount) return 0;
    return tran.type?.includes("receipt") ? tran.amount : -tran.amount;
  };

  const renderTypeLabel = (value) => {
    const map = {
      bank_receipt: "Bank Receipt",
      bank_payment: "Bank Payment",
      cash_receipt: "Cash Receipt",
      cash_payment: "Cash Payment",
    };
    return map[value] || value;
  };

  return {
    mode,
    showBalance,
    fixedBankName,
    baseTitle,
    amount,
    setAmount,
    type,
    setType,
    typeOptions,
    bankName,
    setBankName,
    cashAccount,
    setCashAccount,
    accountId,
    setAccountId,
    accounts,
    transactionDate,
    setTransactionDate,
    banks,
    bankFilter,
    setBankFilter,
    cashFilter,
    setCashFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    filteredTransactions,
    renderTypeLabel,
    getSignedAmount,
    handleSubmit,
    handleDelete,
    handleEdit,
    cancelEdit,
    loadingDelete,
    editingId,
    showBankFilter,
    showCashFilter,
    companyId
  };
}

export function BankBookProvider({ children, mode = "all", showBalance = false, fixedBankName = null }) {
  const controller = useBankBookController({ mode, showBalance, fixedBankName });
  return (
    <BankBookContext.Provider value={controller}>
      {children}
    </BankBookContext.Provider>
  );
}

export function useBankBook() {
  const context = useContext(BankBookContext);
  if (!context) {
    throw new Error("useBankBook must be used within a BankBookProvider");
  }
  return context;
}

export function ReceiptPaymentEntry({ title }) {
  const {
    baseTitle,
    amount,
    setAmount,
    type,
    setType,
    typeOptions,
    renderTypeLabel,
    fixedBankName,
    bankName,
    setBankName,
    banks,
    cashAccount,
    setCashAccount,
    accountId,
    setAccountId,
    accounts,
    transactionDate,
    setTransactionDate,
    handleSubmit,
    editingId,
    cancelEdit,
  } = useBankBook();

  const heading = title || baseTitle;

  return (
    <div className="entry-card">
      <p className="eyebrow">Cash Flow</p>
      <h2>{heading}</h2>
      <p>Capture every receipt or payment with contextual details.</p>
      <form className="entry-form" onSubmit={handleSubmit}>
        <input placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} />
        <select value={type} onChange={e => setType(e.target.value)}>
          {typeOptions.map(option => (
            <option key={option} value={option}>
              {renderTypeLabel(option)}
            </option>
          ))}
        </select>
        {!fixedBankName && !type.includes("cash") && (
          <select value={bankName} onChange={e => setBankName(e.target.value)}>
            <option value="">Select Bank</option>
            {banks.map(bank => (
              <option key={bank.id} value={bank.name}>{bank.name}</option>
            ))}
          </select>
        )}
        {!fixedBankName && type.includes("cash") && (
          <select value={cashAccount} onChange={e => setCashAccount(e.target.value)}>
            {CASH_ACCOUNTS.map(account => (
              <option key={account} value={account}>{account}</option>
            ))}
          </select>
        )}
        {fixedBankName && (
          <div className="selected-book"><strong>Book:</strong> {` ${fixedBankName}`}</div>
        )}
        <select value={accountId} onChange={e => setAccountId(e.target.value)}>
          <option value="">Select Account</option>
          {accounts.map(acc => (
            <option key={`${acc.type}-${acc.id}`} value={acc.id}>
              {acc.name} ({acc.type})
            </option>
          ))}
        </select>
        <input type="date" value={transactionDate} onChange={e => setTransactionDate(e.target.value)} />
        <div className="form-actions">
          <button className="primary-btn" type="submit">
            {editingId ? "Update Entry" : "Save Entry"}
          </button>
          {editingId && (
            <button className="ghost-btn" type="button" onClick={cancelEdit}>
              Cancel Edit
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export function BankBookTransactions({ title = "Transactions", condenseContra = false, sortOrder = "asc" }) {
  const {
    filteredTransactions,
    renderTypeLabel,
    showBalance,
    getSignedAmount,
    handleEdit,
    handleDelete,
    loadingDelete,
    showBankFilter,
    showCashFilter,
    bankFilter,
    setBankFilter,
    cashFilter,
    setCashFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    banks,
  } = useBankBook();

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

  const sortedTransactions = useMemo(() => {
    const list = [...filteredTransactions];
    list.sort((a, b) => {
      const diff = toMillis(a.date) - toMillis(b.date);
      return sortOrder === "asc" ? diff : -diff;
    });
    return list;
  }, [filteredTransactions, sortOrder]);

  const condensedTransactions = useMemo(() => {
    if (!condenseContra) return sortedTransactions;
    const groupMap = new Map();
    const regular = [];

    sortedTransactions.forEach((tran) => {
      if (tran.contraGroupId) {
        const key = tran.contraGroupId;
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            id: key,
            date: tran.date,
            contraType: tran.contraType,
            contraSource: tran.contraSource,
            contraTarget: tran.contraTarget,
            receiptAmount: 0,
            paymentAmount: 0,
            isContraGroup: true,
            transactions: [],
          });
        }
        const entry = groupMap.get(key);
        entry.transactions.push(tran);
        if (tran.type?.includes("receipt")) {
          entry.receiptAmount += tran.amount || 0;
        } else {
          entry.paymentAmount += tran.amount || 0;
        }
      } else {
        regular.push(tran);
      }
    });

    const combined = [...regular, ...Array.from(groupMap.values())];
    combined.sort((a, b) => {
      const diff = toMillis(a.date) - toMillis(b.date);
      return sortOrder === "asc" ? diff : -diff;
    });
    return combined;
  }, [sortedTransactions, condenseContra, sortOrder]);

  const rows = condenseContra ? condensedTransactions : sortedTransactions;
  const balancesEnabled = showBalance && !condenseContra;

  const handleContraEdit = (group) => {
    const target = group.transactions?.[0];
    if (target) {
      handleEdit(target);
    }
  };

  const handleContraDelete = async (group) => {
    const ids = group.transactions?.map(tx => tx.id) || [];
    if (!ids.length) return;
    const confirmDelete = window.confirm("Delete this contra entry?");
    if (!confirmDelete) return;
    for (const id of ids) {
      await handleDelete(id, { skipConfirm: true });
    }
  };

  return (
    <div className="table-card">
      <div className="table-card__header">
        <div>
          <p className="eyebrow">Ledger</p>
          <h3>{title}</h3>
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
          {showBankFilter && (
            <div className="filter-select">
              <label>Bank</label>
              <select value={bankFilter} onChange={e => setBankFilter(e.target.value)}>
                <option value="all">All Banks</option>
                {banks.map(bank => (
                  <option key={`filter-${bank.id}`} value={bank.name}>
                    {bank.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {showCashFilter && (
            <div className="filter-select">
              <label>Cash Book</label>
              <select value={cashFilter} onChange={e => setCashFilter(e.target.value)}>
                <option value="all">All Cash Books</option>
                {CASH_ACCOUNTS.map(account => (
                  <option key={`cash-${account}`} value={account}>
                    {account}
                  </option>
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
            <th>Receipt</th>
            <th>Payment</th>
            <th>Bank</th>
            <th>Account</th>
            {balancesEnabled && <th>Balance</th>}
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            let runningBalance = 0;
            return rows.map(tran => {
              const isContraGroup = tran.isContraGroup;
              const isReceipt = tran.type?.includes?.("receipt");
              const receiptValue = isContraGroup
                ? (tran.receiptAmount || (tran.contraType === "cash-bank" ? tran.paymentAmount : 0))
                : (isReceipt ? tran.amount : "");
              const paymentValue = isContraGroup
                ? (tran.paymentAmount || (tran.contraType === "bank-cash" ? tran.receiptAmount : 0))
                : (!isReceipt ? tran.amount : "");

              if (balancesEnabled && !isContraGroup) {
                runningBalance += getSignedAmount(tran);
              }
              return (
                <tr key={tran.id}>
                  <td>{tran.date?.toDate().toLocaleDateString?.()}</td>
                  <td>{isContraGroup ? (CONTRA_LABELS[tran.contraType] || "Contra") : renderTypeLabel(tran.type)}</td>
                  <td>{receiptValue || ""}</td>
                  <td>{paymentValue || ""}</td>
                  <td>{isContraGroup ? `${tran.contraSource} → ${tran.contraTarget}` : tran.bankName}</td>
                  <td>{isContraGroup ? "Contra Entry" : (tran.accountName || "-")}</td>
                  {balancesEnabled && <td>{runningBalance.toFixed(2)}</td>}
                  <td>
                    <div className="actions">
                      <button
                        className="ghost-btn"
                        type="button"
                        onClick={() => (isContraGroup ? handleContraEdit(tran) : handleEdit(tran))}
                      >
                        Edit
                      </button>
                      <button
                        className="danger-btn"
                        type="button"
                        onClick={() => (isContraGroup ? handleContraDelete(tran) : handleDelete(tran.id))}
                        disabled={loadingDelete}
                      >
                        {loadingDelete ? "..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            });
          })()}
        </tbody>
      </table>
    </div>
  );
}

export function ContraEntry() {
  const {
    companyId,
    banks,
  } = useBankBook();

  const [transferType, setTransferType] = useState("bank-bank");
  const [fromBank, setFromBank] = useState("");
  const [toBank, setToBank] = useState("");
  const [cashAccount, setCashAccount] = useState(CASH_ACCOUNTS[0]);
  const [toCashAccount, setToCashAccount] = useState(CASH_ACCOUNTS[0]);
  const [amount, setAmount] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setAmount("");
    setTransferDate("");
    setFromBank("");
    setToBank("");
    setCashAccount(CASH_ACCOUNTS[0]);
    setToCashAccount(CASH_ACCOUNTS[0]);
  };

  const createGroupId = () =>
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

  const buildEntry = (type, bankName, label, meta) => ({
    companyId,
    amount: parseFloat(amount),
    type,
    bankName,
    accountId: "",
    accountName: `Contra ${label}`,
    accountType: "contra",
    date: Timestamp.fromDate(new Date(transferDate)),
    ...meta,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!companyId) return alert("No company assigned!");
    if (!amount || isNaN(parseFloat(amount))) return alert("Enter a valid amount.");
    if (!transferDate) return alert("Select a transfer date.");

    const contraGroupId = createGroupId();
    let entries = [];
    if (transferType === "bank-bank") {
      if (!fromBank || !toBank) return alert("Select both source and destination banks.");
      if (fromBank === toBank) return alert("Source and destination banks must differ.");
      entries = [
        buildEntry("bank_payment", fromBank, `to ${toBank}`, {
          contraGroupId,
          contraType: "bank-bank",
          contraSource: fromBank,
          contraTarget: toBank,
        }),
        buildEntry("bank_receipt", toBank, `from ${fromBank}`, {
          contraGroupId,
          contraType: "bank-bank",
          contraSource: fromBank,
          contraTarget: toBank,
        }),
      ];
    } else if (transferType === "bank-cash") {
      if (!fromBank) return alert("Select a source bank.");
      entries = [
        buildEntry("bank_payment", fromBank, `to ${toCashAccount}`, {
          contraGroupId,
          contraType: "bank-cash",
          contraSource: fromBank,
          contraTarget: toCashAccount,
        }),
        buildEntry("cash_receipt", toCashAccount, `from ${fromBank}`, {
          contraGroupId,
          contraType: "bank-cash",
          contraSource: fromBank,
          contraTarget: toCashAccount,
        }),
      ];
    } else if (transferType === "cash-bank") {
      if (!toBank) return alert("Select a destination bank.");
      entries = [
        buildEntry("cash_payment", cashAccount, `to ${toBank}`, {
          contraGroupId,
          contraType: "cash-bank",
          contraSource: cashAccount,
          contraTarget: toBank,
        }),
        buildEntry("bank_receipt", toBank, `from ${cashAccount}`, {
          contraGroupId,
          contraType: "cash-bank",
          contraSource: cashAccount,
          contraTarget: toBank,
        }),
      ];
    }

    try {
      setLoading(true);
      const ops = entries.map(entry => addDoc(collection(db, "bankbooks"), entry));
      await Promise.all(ops);
      resetForm();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderBankSelect = (label, value, onChange, placeholder = "Select Bank") => (
    <select value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {banks.map(bank => (
        <option key={`${label}-${bank.id}`} value={bank.name}>
          {bank.name}
        </option>
      ))}
    </select>
  );

  const renderCashSelect = (value, onChange) => (
    <select value={value} onChange={e => onChange(e.target.value)}>
      {CASH_ACCOUNTS.map(account => (
        <option key={`cash-${account}`} value={account}>
          {account}
        </option>
      ))}
    </select>
  );

  return (
    <div className="entry-card">
      <p className="eyebrow">Transfers</p>
      <h2>Contra Entry</h2>
      <p>Move funds between bank and cash ledgers in a single step.</p>
      <form className="entry-form" onSubmit={handleSubmit}>
        <select value={transferType} onChange={e => setTransferType(e.target.value)}>
          <option value="bank-bank">Bank ➜ Bank</option>
          <option value="bank-cash">Bank ➜ Cash</option>
          <option value="cash-bank">Cash ➜ Bank</option>
        </select>
        <input placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} />
        <input type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)} />

        {transferType === "bank-bank" && (
          <>
            {renderBankSelect("from", fromBank, setFromBank, "From Bank")}
            {renderBankSelect("to", toBank, setToBank, "To Bank")}
          </>
        )}

        {transferType === "bank-cash" && (
          <>
            {renderBankSelect("from", fromBank, setFromBank, "From Bank")}
            {renderCashSelect(toCashAccount, setToCashAccount)}
          </>
        )}

        {transferType === "cash-bank" && (
          <>
            {renderCashSelect(cashAccount, setCashAccount)}
            {renderBankSelect("to", toBank, setToBank, "To Bank")}
          </>
        )}

        <div className="form-actions">
          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Contra"}
          </button>
          <button className="ghost-btn" type="button" onClick={resetForm} disabled={loading}>
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}

function BankBook({ mode = "all", showBalance = false, fixedBankName = null }) {
  return (
    <BankBookProvider mode={mode} showBalance={showBalance} fixedBankName={fixedBankName}>
      <div>
        <ReceiptPaymentEntry />
        <BankBookTransactions />
      </div>
    </BankBookProvider>
  );
}

export default BankBook;
