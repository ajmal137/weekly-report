import React, { useState, useEffect } from "react";
import SignUp from "./SignUp";
import Login from "./Login";
import AdminDashboard from "./AdminDashboard";
import { BankBookProvider, ReceiptPaymentEntry, BankBookTransactions, ContraEntry } from "./BankBook";
import PayablesReceivables from "./PayablesReceivables";
import DatewiseReport from "./DatewiseReport";
import MasterDataManager from "./MasterDataManager";
import BooksPage from "./BooksPage";
import { auth, db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { CssBaseline, Button, Container, Box, Typography, Avatar, IconButton, Collapse } from "@mui/material";
import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { ExpandMore, ExpandLess } from "@mui/icons-material";
import "./App.css";

function App() {
  const [showSignUp, setShowSignUp] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState("");
  const location = useLocation();
  const [companyDetails, setCompanyDetails] = useState(null);
  const [showMasters, setShowMasters] = useState(false);
  const [showReceiptEntry, setShowReceiptEntry] = useState(true);
  const [showContraEntry, setShowContraEntry] = useState(false);
  const [companyId, setCompanyId] = useState("");

  const updateCompanyLogo = async (logoData) => {
    if (!companyId) return;
    await setDoc(doc(db, "companies", companyId), { logo: logoData }, { merge: true });
    setCompanyDetails(prev => ({ ...(prev || {}), logo: logoData }));
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !companyId) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        await updateCompanyLogo(reader.result);
      } catch (err) {
        alert(err.message);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleLogoRemove = async () => {
    if (!companyId) return;
    try {
      await updateCompanyLogo("");
    } catch (err) {
      alert(err.message);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setRole(userData.role || "");
          if (userData.companyId) {
            setCompanyId(userData.companyId);
            const companyDoc = await getDoc(doc(db, "companies", userData.companyId));
            if (companyDoc.exists()) {
              setCompanyDetails(companyDoc.data());
            } else {
              setCompanyDetails(null);
            }
          } else {
            setCompanyId("");
            setCompanyDetails(null);
          }
        } else {
          setRole("");
          setCompanyId("");
          setCompanyDetails(null);
        }
      } else {
        setRole("");
        setCompanyId("");
        setCompanyDetails(null);
      }
    });
    return () => unsub();
  }, []);

  const handleLogout = () => signOut(auth);

  const UserHome = () => (
    <Box className="content-scroll">
      <Box className="hero-card">
        <Avatar sx={{ width: 82, height: 82, bgcolor: "#1d4ed8", fontSize: "1.8rem" }}>
          {companyDetails?.logo
            ? <img src={companyDetails.logo} alt="Company Logo" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 18 }} />
            : (companyDetails?.name?.[0] || 'C')}
        </Avatar>
        <Box>
          <p className="eyebrow">Sustainable Growth</p>
          <Typography variant="h5" sx={{ mb: 1 }}>{companyDetails?.name || "Company Name"}</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {companyDetails?.address || "Company address not set"}
          </Typography>
          <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Button component="label" size="small" variant="contained">
              Upload Logo
              <input hidden type="file" accept="image/*" onChange={handleLogoUpload} />
            </Button>
            <Button size="small" variant="outlined" onClick={handleLogoRemove} disabled={!companyDetails?.logo}>
              Remove Logo
            </Button>
          </Box>
        </Box>
      </Box>
      <Box className="section-grid">
        <Box className="full-span">
          <BankBookTransactions title="Recent Activity" condenseContra sortOrder="desc" />
        </Box>
        <Box className="section-card">
          <PayablesReceivables />
        </Box>
        <Box className="section-card">
          <DatewiseReport />
        </Box>
      </Box>
    </Box>
  );

  if (currentUser) {
    if (role === "admin") {
      return (
        <Box sx={{ p: 2 }}>
          <CssBaseline />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="outlined" color="secondary" onClick={handleLogout}>Logout</Button>
          </Box>
          <AdminDashboard />
        </Box>
      );
    } else {
      return (
        <BankBookProvider>
          <CssBaseline />
          <div className="app-shell">
            <Box component="nav" className="sidebar-panel">
              <Typography variant="h6">Control Center</Typography>
              <Button
                fullWidth
                component={Link}
                to="/"
                className={`sidebar-link ${location.pathname === "/" ? "active" : ""}`}
              >
                Dashboard
              </Button>
              <Button
                fullWidth
                component={Link}
                to="/books"
                className={`sidebar-link ${location.pathname === "/books" ? "active" : ""}`}
              >
                Books
              </Button>
              <div className="sidebar-section">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle1" className="sidebar-section-title">
                    Quick Masters
                  </Typography>
                  <IconButton size="small" onClick={() => setShowMasters(!showMasters)}>
                    {showMasters ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </Box>
                <Collapse in={showMasters}>
                  <MasterDataManager />
                </Collapse>
              </div>
              <div className="sidebar-section">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle1" className="sidebar-section-title">
                    Receipt/Payment Entry
                  </Typography>
                  <IconButton size="small" onClick={() => setShowReceiptEntry(!showReceiptEntry)}>
                    {showReceiptEntry ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </Box>
                <Collapse in={showReceiptEntry}>
                  <Box sx={{ mt: 1 }}>
                    <ReceiptPaymentEntry title="Receipt/Payment Entry" />
                  </Box>
                </Collapse>
              </div>
              <div className="sidebar-section">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle1" className="sidebar-section-title">
                    Contra Entry
                  </Typography>
                  <IconButton size="small" onClick={() => setShowContraEntry(!showContraEntry)}>
                    {showContraEntry ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </Box>
                <Collapse in={showContraEntry}>
                  <Box sx={{ mt: 1 }}>
                    <ContraEntry />
                  </Box>
                </Collapse>
              </div>
              <Box sx={{ flexGrow: 1 }} />
              <Button className="logout-btn" onClick={handleLogout}>
                Logout
              </Button>
            </Box>

            <Box className="content-panel">
              <Routes>
                <Route path="/" element={<UserHome />} />
                <Route path="/books" element={<BooksPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Box>
          </div>
        </BankBookProvider>
      );
    }
  }

  if (location.pathname !== "/") {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <CssBaseline />
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Box className="auth-card">
          <Typography variant="h5" gutterBottom>Welcome</Typography>
          <Box sx={{ mb: 2 }}>
            <Button variant={showSignUp ? "outlined" : "contained"} sx={{ mr: 1 }} onClick={() => setShowSignUp(false)}>
              Login
            </Button>
            <Button variant={showSignUp ? "contained" : "outlined"} onClick={() => setShowSignUp(true)}>
              Sign Up
            </Button>
          </Box>
          {showSignUp ? <SignUp /> : <Login />}
        </Box>
      </Container>
    </>
  );
}

export default App;
