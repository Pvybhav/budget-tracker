import { Link, Outlet, useLocation } from "react-router-dom";
import {
  CreditCard,
  Receipt,
  HandCoins,
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
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useState, useEffect } from "react";

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function Layout() {
  const location = useLocation();
  const [isExpensesOpen, setIsExpensesOpen] = useState(
    location.pathname.includes("/expenses"),
  );

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (location.pathname.includes("/expenses")) {
      setIsExpensesOpen(true);
    }
    // Close sidebar on mobile when navigating
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const navItems = [
    { name: "Dashboard", path: "/", icon: CreditCard },
    { name: "Manage Cards", path: "/cards", icon: CreditCard },
    { name: "Manage Loans", path: "/loans", icon: DollarSign },
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-950 text-slate-200">
      {/* Mobile Topbar */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900 z-30 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Budget Tracker
          </h1>
          {location.pathname !== "/" && (
            <Link
              to="/"
              className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg transition-colors border border-slate-700"
              title="Go to Dashboard"
            >
              <LayoutDashboard className="w-5 h-5" />
            </Link>
          )}
        </div>
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-1 text-slate-400 hover:text-white focus:outline-none"
        >
          {isSidebarOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 w-64 bg-slate-900 border-r border-slate-800 flex flex-col z-50 transform transition-transform duration-300 md:relative md:translate-x-0 shrink-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="p-6 hidden md:block">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 p-1 to-emerald-400 bg-clip-text text-transparent">
            Budget Tracker
          </h1>
        </div>
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto mt-6 md:mt-0">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                  isActive
                    ? "bg-slate-800 text-white font-medium"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50",
                )}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}

          {/* Manage Expenses Accordion */}
          <div>
            <button
              onClick={() => setIsExpensesOpen(!isExpensesOpen)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors",
                location.pathname.includes("/expenses")
                  ? "text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50",
              )}
            >
              <div className="flex items-center gap-3">
                <Receipt className="w-5 h-5" />
                <span>Manage Expenses</span>
              </div>
              {isExpensesOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {isExpensesOpen && (
              <div className="mt-1 ml-9 space-y-1">
                <Link
                  to="/expenses/monthly"
                  className={cn(
                    "block px-3 py-2 text-sm rounded-lg transition-colors",
                    location.pathname === "/expenses/monthly"
                      ? "bg-slate-800 text-white font-medium"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50",
                  )}
                >
                  Monthly Manage
                </Link>
                <Link
                  to="/expenses/yearly"
                  className={cn(
                    "block px-3 py-2 text-sm rounded-lg transition-colors",
                    location.pathname === "/expenses/yearly"
                      ? "bg-slate-800 text-white font-medium"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50",
                  )}
                >
                  Yearly Manage
                </Link>
              </div>
            )}
          </div>

          <Link
            to="/categories"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
              location.pathname === "/categories"
                ? "bg-slate-800 text-white font-medium"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50",
            )}
          >
            <Tags className="w-5 h-5" />
            Manage Categories
          </Link>

          <Link
            to="/payments"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
              location.pathname === "/payments"
                ? "bg-slate-800 text-white font-medium"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50",
            )}
          >
            <HandCoins className="w-5 h-5" />
            Manage Payments
          </Link>

          <Link
            to="/savings-goals"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
              location.pathname === "/savings-goals"
                ? "bg-slate-800 text-white font-medium"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50",
            )}
          >
            <PiggyBank className="w-5 h-5" />
            Savings Goals
          </Link>

          <Link
            to="/visualize"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
              location.pathname === "/visualize"
                ? "bg-slate-800 text-white font-medium"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50",
            )}
          >
            <ChartPie className="w-5 h-5" />
            Visualize
          </Link>

          <Link
            to="/export"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
              location.pathname === "/export"
                ? "bg-slate-800 text-white font-medium"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50",
            )}
          >
            <FileSpreadsheet className="w-5 h-5" />
            Export Data
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-800 mt-auto">
          <Link
            to="/about"
            className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-slate-400 hover:text-white hover:bg-slate-800/50"
          >
            <Info className="w-5 h-5" />
            About
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-slate-950 p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
