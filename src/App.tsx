import { useEffect, useState } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import ManageCardsPage from "./pages/ManageCardsPage";
import ManageExpensesPage from "./pages/ManageExpensesPage";
import ManagePaymentsPage from "./pages/ManagePaymentsPage";
import ManageBillsPage from "./pages/ManageBillsPage";
import ManageCategoriesPage from "./pages/ManageCategoriesPage";
import ManageLoansPage from "./pages/ManageLoansPage";
import ManageIncomePage from "./pages/ManageIncomePage";
import ManageInsurancePage from "./pages/ManageInsurancePage";
import ManageBudgetRulesPage from "./pages/ManageBudgetRulesPage";
import VisualizePage from "./pages/VisualizePage";
import ExportPage from "./pages/ExportPage";
import AboutPage from "./pages/AboutPage";
import SavingsGoalsPage from "./pages/SavingsGoalsPage";
import InvestmentsPage from "./pages/InvestmentsPage";
import ManageTransfersPage from "./pages/ManageTransfersPage";
import ImportPage from "./pages/ImportPage";
import ReconciliationPage from "./pages/ReconciliationPage";
import FinancialCalendarPage from "./pages/FinancialCalendarPage";
import SubscriptionsPage from "./pages/SubscriptionsPage";
import NetWorthHistoryPage from "./pages/NetWorthHistoryPage";
function ProtectedApp({ onLogout }: { onLogout: () => void }) {
  return (
    <Routes>
      {" "}
      <Route path="/" element={<Layout logout={onLogout} />}>
        {" "}
        <Route index element={<HomePage />} /> <Route path="cards" element={<ManageCardsPage />} />{" "}
        <Route path="categories" element={<ManageCategoriesPage />} />{" "}
        <Route path="expenses/monthly" element={<ManageExpensesPage mode="monthly" />} />{" "}
        <Route path="expenses/yearly" element={<ManageExpensesPage mode="yearly" />} />{" "}
        <Route path="expenses/emi" element={<ManageExpensesPage mode="emi" />} />{" "}
        <Route path="payments" element={<ManagePaymentsPage />} />{" "}
        <Route path="transfers" element={<ManageTransfersPage />} />{" "}
        <Route path="import" element={<ImportPage />} />{" "}
        <Route path="reconciliation" element={<ReconciliationPage />} />{" "}
        <Route path="calendar" element={<FinancialCalendarPage />} />{" "}
        <Route path="subscriptions" element={<SubscriptionsPage />} />{" "}
        <Route path="net-worth-history" element={<NetWorthHistoryPage />} />{" "}
        <Route path="bills" element={<ManageBillsPage />} />{" "}
        <Route path="income" element={<ManageIncomePage />} />{" "}
        <Route path="loans" element={<ManageLoansPage />} />{" "}
        <Route path="insurance" element={<ManageInsurancePage />} />{" "}
        <Route path="budget-rules" element={<ManageBudgetRulesPage />} />{" "}
        <Route path="savings-goals" element={<SavingsGoalsPage />} />{" "}
        <Route path="investments" element={<InvestmentsPage />} />{" "}
        <Route path="visualize" element={<VisualizePage />} />{" "}
        <Route path="export" element={<ExportPage />} />{" "}
        <Route path="about" element={<AboutPage />} />{" "}
        <Route path="*" element={<Navigate to="/" replace />} />{" "}
      </Route>{" "}
    </Routes>
  );
}
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/auth/session", { credentials: "include" });
        setIsAuthenticated(response.ok);
      } catch {
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        {" "}
        Checking session...{" "}
      </div>
    );
  }
  return (
    <HashRouter>
      {" "}
      <Routes>
        {" "}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <LoginPage onAuthenticated={() => setIsAuthenticated(true)} />
            )
          }
        />{" "}
        <Route
          path="*"
          element={
            isAuthenticated ? (
              <ProtectedApp onLogout={() => setIsAuthenticated(false)} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />{" "}
      </Routes>{" "}
    </HashRouter>
  );
}
export default App;
