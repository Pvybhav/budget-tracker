import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  CreditCard,
  Receipt,
  HandCoins,
  ReceiptText,
  PiggyBank,
  Info,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
  LayoutDashboard,
  Tags,
  ChartPie,
  FileSpreadsheet,
  DollarSign,
  Banknote,
  ShieldCheck,
  TrendingUp,
  ListChecks,
  ArrowRightLeft,
  FileUp,
  CheckCircle2,
  CalendarDays,
  RefreshCw,
  LineChart,
  LogOut,
  Users,
  Gift,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "../utils/cn";
import ThemeSwitcher from "./ThemeSwitcher";
import {
  SUPPORTED_CURRENCIES,
  setDisplayCurrency,
  useDisplayCurrency,
} from "../services/currency.service";
type LayoutProps = { logout?: () => void };
export default function Layout({ logout }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isExpensesOpen, setIsExpensesOpen] = useState(location.pathname.includes("/expenses"));
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const displayCurrency = useDisplayCurrency();
  useEffect(() => {
    if (location.pathname.includes("/expenses")) {
      setIsExpensesOpen(true);
    }
    setIsSidebarOpen(false);
  }, [location.pathname]);
  const navItems = [
    { name: "Dashboard", path: "/", icon: CreditCard },
    { name: "Manage Cards", path: "/cards", icon: CreditCard },
    { name: "Rewards", path: "/rewards", icon: Gift },
    { name: "Manage Loans", path: "/loans", icon: DollarSign },
    { name: "Manage Insurance", path: "/insurance", icon: ShieldCheck },
  ];
  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {" "}
      {/* Mobile Topbar */}{" "}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-30 shrink-0">
        {" "}
        <div className="flex items-center gap-4">
          {" "}
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 dark:from-blue-400 to-emerald-600 dark:to-emerald-400 bg-clip-text text-transparent">
            {" "}
            Budget Tracker{" "}
          </h1>{" "}
          {location.pathname !== "/" && (
            <Link
              to="/"
              className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors border border-slate-300 dark:border-slate-700"
              title="Go to Dashboard"
            >
              {" "}
              <LayoutDashboard className="w-5 h-5" />{" "}
            </Link>
          )}{" "}
        </div>{" "}
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white focus:outline-none"
          >
            {" "}
            {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}{" "}
          </button>{" "}
        </div>
      </div>{" "}
      {/* Overlay for mobile sidebar */}{" "}
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}{" "}
      {/* Sidebar */}{" "}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-50 transform transition-transform duration-300 md:relative md:translate-x-0 shrink-0 shadow-lg dark:shadow-xl",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {" "}
        <div className="p-6 hidden md:flex items-center justify-between">
          {" "}
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 dark:from-blue-400 to-emerald-600 dark:to-emerald-400 bg-clip-text text-transparent">
            {" "}
            Budget Tracker{" "}
          </h1>{" "}
          <ThemeSwitcher />
        </div>{" "}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto mt-4 md:mt-2">
          {" "}
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                  isActive
                    ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
                )}
              >
                {" "}
                <Icon className="w-5 h-5 flex-shrink-0" />{" "}
                <span className="text-sm">{item.name}</span>{" "}
              </Link>
            );
          })}{" "}
          {/* Manage Expenses Accordion */}{" "}
          <div>
            {" "}
            <button
              type="button"
              onClick={() => setIsExpensesOpen(!isExpensesOpen)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200",
                location.pathname.includes("/expenses")
                  ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
              )}
            >
              {" "}
              <div className="flex items-center gap-3">
                {" "}
                <Receipt className="w-5 h-5 flex-shrink-0" />{" "}
                <span className="text-sm">Manage Expenses</span>{" "}
              </div>{" "}
              {isExpensesOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}{" "}
            </button>{" "}
            {isExpensesOpen && (
              <div className="mt-1 ml-8 space-y-1">
                {" "}
                <Link
                  to="/expenses/monthly"
                  className={cn(
                    "block px-3 py-2 text-sm rounded-lg transition-all duration-200",
                    location.pathname === "/expenses/monthly"
                      ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
                  )}
                >
                  {" "}
                  Monthly Manage{" "}
                </Link>{" "}
                <Link
                  to="/expenses/yearly"
                  className={cn(
                    "block px-3 py-2 text-sm rounded-lg transition-all duration-200",
                    location.pathname === "/expenses/yearly"
                      ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
                  )}
                >
                  {" "}
                  Yearly Manage{" "}
                </Link>{" "}
                <Link
                  to="/expenses/emi"
                  className={cn(
                    "block px-3 py-2 text-sm rounded-lg transition-all duration-200",
                    location.pathname === "/expenses/emi"
                      ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
                  )}
                >
                  {" "}
                  EMI Payments{" "}
                </Link>{" "}
              </div>
            )}{" "}
          </div>{" "}
          <Link
            to="/categories"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/categories"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            {" "}
            <Tags className="w-5 h-5 flex-shrink-0" />{" "}
            <span className="text-sm">Manage Categories</span>{" "}
          </Link>{" "}
          <Link
            to="/income"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/income"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            {" "}
            <Banknote className="w-5 h-5 flex-shrink-0" />{" "}
            <span className="text-sm">Manage Income</span>{" "}
          </Link>{" "}
          <Link
            to="/payments"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/payments"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            {" "}
            <HandCoins className="w-5 h-5 flex-shrink-0" />{" "}
            <span className="text-sm">Manage Payments</span>{" "}
          </Link>{" "}
          <Link
            to="/transfers"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/transfers"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            {" "}
            <ArrowRightLeft className="w-5 h-5 flex-shrink-0" />{" "}
            <span className="text-sm">Account Transfers</span>{" "}
          </Link>{" "}
          <Link
            to="/import"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/import"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            {" "}
            <FileUp className="w-5 h-5 flex-shrink-0" />{" "}
            <span className="text-sm">Import Transactions</span>{" "}
          </Link>{" "}
          <Link
            to="/reconciliation"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/reconciliation"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            {" "}
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />{" "}
            <span className="text-sm">Reconciliation</span>{" "}
          </Link>{" "}
          <Link
            to="/calendar"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/calendar"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            {" "}
            <CalendarDays className="w-5 h-5 flex-shrink-0" />{" "}
            <span className="text-sm">Financial Calendar</span>{" "}
          </Link>{" "}
          <Link
            to="/subscriptions"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/subscriptions"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            {" "}
            <RefreshCw className="w-5 h-5 flex-shrink-0" />{" "}
            <span className="text-sm">Subscriptions</span>{" "}
          </Link>{" "}
          <Link
            to="/net-worth-history"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/net-worth-history"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            {" "}
            <LineChart className="w-5 h-5 flex-shrink-0" />{" "}
            <span className="text-sm">Net Worth History</span>{" "}
          </Link>{" "}
          <Link
            to="/bills"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/bills"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            {" "}
            <ReceiptText className="w-5 h-5 flex-shrink-0" />{" "}
            <span className="text-sm">Manage Bills</span>{" "}
          </Link>{" "}
          <Link
            to="/savings-goals"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/savings-goals"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            {" "}
            <PiggyBank className="w-5 h-5 flex-shrink-0" />{" "}
            <span className="text-sm">Savings Goals</span>{" "}
          </Link>{" "}
          <Link
            to="/investments"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/investments"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            {" "}
            <TrendingUp className="w-5 h-5 flex-shrink-0" />{" "}
            <span className="text-sm">Investments</span>{" "}
          </Link>{" "}
          <Link
            to="/budget-rules"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/budget-rules"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            {" "}
            <ListChecks className="w-5 h-5 flex-shrink-0" />{" "}
            <span className="text-sm">Budget Rules</span>{" "}
          </Link>{" "}
          <Link
            to="/visualize"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/visualize"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            {" "}
            <ChartPie className="w-5 h-5 flex-shrink-0" />{" "}
            <span className="text-sm">Visualize</span>{" "}
          </Link>{" "}
          <Link
            to="/export"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/export"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            {" "}
            <FileSpreadsheet className="w-5 h-5 flex-shrink-0" />{" "}
            <span className="text-sm">Export Data</span>{" "}
          </Link>{" "}
          <Link
            to="/household"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/household"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            {" "}
            <Users className="w-5 h-5 flex-shrink-0" />{" "}
            <span className="text-sm">Household</span>{" "}
          </Link>{" "}
        </nav>{" "}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 mt-auto space-y-3">
          {" "}
          <label
            htmlFor="display-currency"
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400"
          >
            {" "}
            <span>Display Currency</span>{" "}
            <select
              id="display-currency"
              value={displayCurrency}
              onChange={(e) => setDisplayCurrency(e.target.value)}
              className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol})
                </option>
              ))}
            </select>
          </label>{" "}
          <Link
            to="/about"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50"
          >
            {" "}
            <Info className="w-5 h-5 flex-shrink-0" /> <span className="text-sm">About</span>{" "}
          </Link>{" "}
          <button
            type="button"
            onClick={async () => {
              try {
                await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
              } finally {
                logout?.();
                navigate("/login", { replace: true });
              }
            }}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-red-100 dark:hover:bg-slate-800/50"
          >
            {" "}
            <LogOut className="w-5 h-5 flex-shrink-0" />{" "}
            <span className="text-sm">Log out</span>{" "}
          </button>{" "}
        </div>{" "}
      </aside>{" "}
      {/* Main Content */}{" "}
      <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-4 sm:p-8 transition-colors duration-300">
        {" "}
        <div className="max-w-6xl mx-auto">
          {" "}
          <Outlet />{" "}
        </div>{" "}
      </main>{" "}
    </div>
  );
}
