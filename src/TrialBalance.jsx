import React, { useEffect, useMemo, useState } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { CASH_ACCOUNTS } from "./BankBook";

const MASTER_SOURCES = [
    { key: "bank", label: "Bank", collection: "banks" },
    { key: "party", label: "Party", collection: "parties" },
    { key: "expense", label: "Expense", collection: "expenses" },
    { key: "income", label: "Income", collection: "income" },
];

const LABELS = {
    bank: "Bank",
    cash: "Cash",
    party: "Party",
    expense: "Expense",
    income: "Income",
    contra: "Contra",
};

const currency = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
});

function TrialBalance() {
    const [companyId, setCompanyId] = useState("");
    const [masters, setMasters] = useState({});
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                const userData = userDoc.data();
                setCompanyId(userData?.companyId || "");
            } else {
                setCompanyId("");
            }
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!companyId) return;
        let isMounted = true;
        const fetchMasters = async () => {
            const data = {};
            for (const source of MASTER_SOURCES) {
                const snap = await getDocs(query(collection(db, source.collection), where("companyId", "==", companyId)));
                data[source.key] = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            }
            if (isMounted) {
                setMasters(data);
            }
        };
        fetchMasters();
        return () => {
            isMounted = false;
        };
    }, [companyId]);

    useEffect(() => {
        if (!companyId) return;
        const q = query(collection(db, "bankbooks"), where("companyId", "==", companyId));
        const unsub = onSnapshot(q, (snap) => {
            setTransactions(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });
        return () => unsub();
    }, [companyId]);

    const trialRows = useMemo(() => {
        const map = new Map();
        const ensureEntry = (key, name, category) => {
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    name,
                    category,
                    debit: 0,
                    credit: 0,
                });
            }
            return map.get(key);
        };

        const seedAccounts = () => {
            MASTER_SOURCES.forEach((source) => {
                (masters[source.key] || []).forEach((item) => {
                    ensureEntry(`${source.key}::${item.name}`, item.name, LABELS[source.key]);
                });
            });
            CASH_ACCOUNTS.forEach((cashName) => {
                ensureEntry(`cash::${cashName}`, cashName, LABELS.cash);
            });
        };

        seedAccounts();

        transactions.forEach((tran) => {
            const amount = parseFloat(tran.amount) || 0;
            if (!amount) return;

            const isReceipt = tran.type?.includes("receipt");
            const bankKey = `bank::${tran.bankName}`;
            const bankCategory = CASH_ACCOUNTS.includes(tran.bankName) ? LABELS.cash : LABELS.bank;
            const bankEntry = ensureEntry(bankKey, tran.bankName, bankCategory);
            if (isReceipt) {
                bankEntry.debit += amount;
            } else {
                bankEntry.credit += amount;
            }

            const accName = tran.accountName || "-";
            const accType = tran.accountType || "contra";
            if (accType !== "contra") {
                const accountEntry = ensureEntry(`${accType}::${accName}`, accName, LABELS[accType] || "Account");
                if (isReceipt) {
                    accountEntry.credit += amount;
                } else {
                    accountEntry.debit += amount;
                }
            }
        });

        return Array.from(map.values()).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    }, [masters, transactions]);

    const displayRows = useMemo(() => trialRows.filter(row => row.debit || row.credit), [trialRows]);

    const totals = useMemo(() => {
        return displayRows.reduce(
            (acc, row) => {
                acc.debit += row.debit;
                acc.credit += row.credit;
                return acc;
            },
            { debit: 0, credit: 0 }
        );
    }, [displayRows]);

    return (
        <div className="table-card">
            <div className="table-card__header">
                <div>
                    <p className="eyebrow">Balances</p>
                    <h3>Trial Balance</h3>
                </div>
            </div>
            {loading ? (
                <p>Loading balances...</p>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th>Account</th>
                            <th>Debit</th>
                            <th>Credit</th>
                            <th>Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayRows.map((row) => {
                            const balance = row.debit - row.credit;
                            const netLabel = balance >= 0 ? "Dr" : "Cr";
                            return (
                                <tr key={row.key}>
                                    <td>{row.name}</td>
                                    <td>{row.debit ? currency.format(row.debit) : "-"}</td>
                                    <td>{row.credit ? currency.format(row.credit) : "-"}</td>
                                    <td>{balance ? `${currency.format(Math.abs(balance))} ${netLabel}` : "-"}</td>
                                </tr>
                            );
                        })}
                        <tr>
                            <td><strong>Total</strong></td>
                            <td><strong>{currency.format(totals.debit)}</strong></td>
                            <td><strong>{currency.format(totals.credit)}</strong></td>
                            <td><strong>{currency.format(Math.abs(totals.debit - totals.credit))}</strong></td>
                        </tr>
                    </tbody>
                </table>
            )}
        </div>
    );
}

export default TrialBalance;

