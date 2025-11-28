import React, { useState } from "react";
import { Box, Tabs, Tab } from "@mui/material";
import BankBook from "./BankBook";
import PartyBooks from "./PartyBooks";
import ExpenseIncomeBooks from "./ExpenseIncomeBooks";
import TrialBalance from "./TrialBalance";

function BooksPage() {
  const [tab, setTab] = useState("bank");

  return (
    <Box sx={{ mt: 2 }}>
      <Tabs value={tab} onChange={(_, value) => setTab(value)}>
        <Tab label="Bank Book" value="bank" />
        <Tab label="Cash Book" value="cash" />
        <Tab label="Party Books" value="party" />
        <Tab label="Expense/Income" value="expense-income" />
        <Tab label="Trial Balance" value="trial-balance" />
      </Tabs>
      <Box sx={{ mt: 2 }}>
        {tab === "bank" && <BankBook mode="bank" showBalance />}
        {tab === "cash" && <BankBook mode="cash" showBalance />}
        {tab === "party" && <PartyBooks />}
        {tab === "expense-income" && <ExpenseIncomeBooks />}
        {tab === "trial-balance" && <TrialBalance />}
      </Box>
    </Box>
  );
}

export default BooksPage;
