import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import Tooltip from "./Tooltip";
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
  WalletCards,
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
const manageNavItems = [
  { name: "Manage Loans", path: "/loans", icon: DollarSign },
  { name: "Manage Insurance", path: "/insurance", icon: ShieldCheck },
  { name: "Manage Expenses (Yearly)", path: "/expenses/yearly", icon: Receipt },
  { name: "EMI Payments", path: "/expenses/emi", icon: Receipt },
  { name: "Manage Categories", path: "/categories", icon: Tags },
  { name: "Manage Income", path: "/income", icon: Banknote },
  { name: "Account Transfers", path: "/transfers", icon: ArrowRightLeft },
  { name: "Budget Rules", path: "/budget-rules", icon: ListChecks },
  { name: "Household", path: "/household", icon: Users },
];
export default function Layout({ logout }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isManageOpen, setIsManageOpen] = useState(() =>
    manageNavItems.some(
      ({ path }) => location.pathname === path || location.pathname.startsWith(`${path}/`),
    ),
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const displayCurrency = useDisplayCurrency();
  useEffect(() => {
    setIsManageOpen(
      manageNavItems.some(
        ({ path }) => location.pathname === path || location.pathname.startsWith(`${path}/`),
      ),
    );
    setIsSidebarOpen(false);
  }, [location.pathname]);
  const navItems = [
    { name: "Dashboard", path: "/", icon: CreditCard },
    { name: "Expenses", path: "/expenses/monthly", icon: Receipt },
    { name: "Bills", path: "/bills", icon: ReceiptText },
    { name: "Payments", path: "/payments", icon: HandCoins },
    { name: "Cards", path: "/cards", icon: CreditCard },
    { name: "Savings Goals", path: "/savings-goals", icon: PiggyBank },
    { name: "Rewards", path: "/rewards", icon: Gift },
  ];
  return (
    <div className="flex flex-col md:flex-row h-dvh min-h-0 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Mobile Topbar */}
      <div className="md:hidden flex items-center justify-between gap-2 px-3 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-30 shrink-0">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-lg font-bold bg-gradient-to-r from-blue-600 dark:from-blue-400 to-emerald-600 dark:to-emerald-400 bg-clip-text text-transparent">
            Budget Tracker
          </h1>
          {location.pathname !== "/" && (
            <Tooltip content="Go to Dashboard">
              <Link
                to="/"
                className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors border border-slate-300 dark:border-slate-700"
              >
                <LayoutDashboard className="w-5 h-5" />
              </Link>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white focus:outline-none"
          >
            {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>
      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-50 transform transition-transform duration-300 md:relative md:translate-x-0 md:w-60 xl:w-64 shrink-0 shadow-lg dark:shadow-xl",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="p-6 hidden md:flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400">
              <WalletCards className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 dark:from-blue-400 to-emerald-600 dark:to-emerald-400 bg-clip-text text-transparent">
              Budget Tracker
            </h1>
          </div>
          <ThemeSwitcher />
        </div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto mt-4 md:mt-2">
          <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Overview
          </p>
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
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
          {/* Management routes */}
          <div>
            <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Organize
            </p>
            <button
              type="button"
              aria-expanded={isManageOpen}
              onClick={() => setIsManageOpen(!isManageOpen)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200",
                manageNavItems.some(
                  ({ path }) =>
                    location.pathname === path || location.pathname.startsWith(`${path}/`),
                )
                  ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
              )}
            >
              <div className="flex items-center gap-3">
                <ListChecks className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">Manage</span>
              </div>
              {isManageOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            {isManageOpen && (
              <div className="mt-1 ml-8 space-y-1">
                {manageNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all duration-200",
                        isActive
                          ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
          <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Tools
          </p>
          <Link
            to="/import"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/import"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            <FileUp className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">Import Transactions</span>
          </Link>
          <Link
            to="/reconciliation"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/reconciliation"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">Reconciliation</span>
          </Link>
          <Link
            to="/calendar"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/calendar"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            <CalendarDays className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">Financial Calendar</span>
          </Link>
          <Link
            to="/subscriptions"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/subscriptions"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            <RefreshCw className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">Subscriptions</span>
          </Link>
          <Link
            to="/net-worth-history"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/net-worth-history"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            <LineChart className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">Net Worth History</span>
          </Link>
          <Link
            to="/savings-goals"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/savings-goals"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            <PiggyBank className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">Savings Goals</span>
          </Link>
          <Link
            to="/investments"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/investments"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            <TrendingUp className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">Investments</span>
          </Link>
          <Link
            to="/visualize"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/visualize"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            <ChartPie className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">Visualize</span>
          </Link>
          <Link
            to="/export"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
              location.pathname === "/export"
                ? "bg-blue-100 dark:bg-slate-800 text-blue-700 dark:text-blue-400 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50",
            )}
          >
            <FileSpreadsheet className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">Export Data</span>
          </Link>
        </nav>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 mt-auto space-y-3">
          <label
            htmlFor="display-currency"
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400"
          >
            <span>Display Currency</span>
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
          </label>
          <Link
            to="/about"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/50"
          >
            <Info className="w-5 h-5 flex-shrink-0" /> <span className="text-sm">About</span>
          </Link>
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
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">Log out</span>
          </button>
        </div>
      </aside>
      {/* Main Content */}
      <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-gradient-to-br from-emerald-50/60 via-slate-50 to-slate-50 dark:from-emerald-950/20 dark:via-slate-950 dark:to-slate-950 p-3 sm:p-4 lg:p-5 transition-colors duration-300">
        <div className="w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
