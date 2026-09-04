import { lazy, Suspense, useEffect, useState } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";

const HomePage = lazy(() => import("./pages/HomePage"));
const ManageCardsPage = lazy(() => import("./pages/ManageCardsPage"));
const ManageExpensesPage = lazy(() => import("./pages/ManageExpensesPage"));
const ManagePaymentsPage = lazy(() => import("./pages/ManagePaymentsPage"));
const ManageBillsPage = lazy(() => import("./pages/ManageBillsPage"));
const ManageCategoriesPage = lazy(() => import("./pages/ManageCategoriesPage"));
const ManageLoansPage = lazy(() => import("./pages/ManageLoansPage"));
const ManageIncomePage = lazy(() => import("./pages/ManageIncomePage"));
const ManageInsurancePage = lazy(() => import("./pages/ManageInsurancePage"));
const ManageBudgetRulesPage = lazy(() => import("./pages/ManageBudgetRulesPage"));
const VisualizePage = lazy(() => import("./pages/VisualizePage"));
const ExportPage = lazy(() => import("./pages/ExportPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const SavingsGoalsPage = lazy(() => import("./pages/SavingsGoalsPage"));
const InvestmentsPage = lazy(() => import("./pages/InvestmentsPage"));
const ManageTransfersPage = lazy(() => import("./pages/ManageTransfersPage"));
const ImportPage = lazy(() => import("./pages/ImportPage"));
const ReconciliationPage = lazy(() => import("./pages/ReconciliationPage"));
const FinancialCalendarPage = lazy(() => import("./pages/FinancialCalendarPage"));
const SubscriptionsPage = lazy(() => import("./pages/SubscriptionsPage"));
const NetWorthHistoryPage = lazy(() => import("./pages/NetWorthHistoryPage"));
const ManageHouseholdPage = lazy(() => import("./pages/ManageHouseholdPage"));
const AcceptInvitePage = lazy(() => import("./pages/AcceptInvitePage"));
const RewardsPage = lazy(() => import("./pages/RewardsPage"));

function PageFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-slate-500 dark:text-slate-400">
      Loading...
    </div>
  );
}
function ProtectedApp({ onLogout }: { onLogout: () => void }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {" "}
        <Route path="/" element={<Layout logout={onLogout} />}>
          {" "}
          <Route index element={<HomePage />} />{" "}
          <Route path="cards" element={<ManageCardsPage />} />{" "}
          <Route path="rewards" element={<RewardsPage />} />{" "}
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
          <Route path="household" element={<ManageHouseholdPage />} />{" "}
          <Route path="accept-invite" element={<AcceptInvitePage />} />{" "}
          <Route path="about" element={<AboutPage />} />{" "}
          <Route path="*" element={<Navigate to="/" replace />} />{" "}
        </Route>{" "}
      </Routes>
    </Suspense>
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200">
        {" "}
        Checking session...{" "}
      </div>
    );
  }
  return (
    <ThemeProvider>
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
    </ThemeProvider>
  );
}
export default App;
