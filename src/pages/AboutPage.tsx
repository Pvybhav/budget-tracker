import {
  Mail,
  ArrowLeft,
  Heart,
  ShieldCheck,
  PenLine,
  Sparkles,
  DatabaseZap,
  CalendarCheck,
  BarChart3,
  BookOpenCheck,
  RefreshCcwDot,
} from "lucide-react";
import { Link } from "react-router-dom";

const PHILOSOPHY = [
  {
    icon: ShieldCheck,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/20",
    title: "Your financial picture, in one place.",
    body: "Track accounts, expenses, income, loans, insurance, investments, transfers, and savings goals from one authenticated workspace.",
  },
  {
    icon: PenLine,
    color: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/20",
    title: "Manual by design.",
    body: "You decide what gets recorded and how it is categorized. That keeps the data understandable, reviewable, and grounded in your actual financial decisions.",
  },
  {
    icon: Sparkles,
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/20",
    title: "Small entries create useful patterns.",
    body: "Budgets, recurring records, contribution history, repayment schedules, and visual reports turn everyday entries into decisions you can act on.",
  },
  {
    icon: RefreshCcwDot,
    color: "text-violet-400",
    bg: "bg-violet-400/10 border-violet-400/20",
    title: "Flexible across accounts and currencies.",
    body: "Use the display currency that makes sense to you while keeping each record's original currency intact. Shared household access lets the right people work from the same financial picture.",
  },
];

const FEATURES = [
  {
    icon: BarChart3,
    label: "Credit utilization, available credit, and liability-aware dashboards",
  },
  {
    icon: CalendarCheck,
    label: "Billing-cycle-aware EMI installment tracking",
  },
  {
    icon: BookOpenCheck,
    label: "Category budgets, carryover, forecasts, and recommendations",
  },
  { icon: DatabaseZap, label: "Authenticated server persistence with household sharing" },
  { icon: ShieldCheck, label: "Insurance policies, premium history, and due-date alerts" },
  { icon: Sparkles, label: "Rewards ledger with redemptions, expiry, and cash value" },
  { icon: CalendarCheck, label: "Savings goals with contribution history and recurring plans" },
  {
    icon: RefreshCcwDot,
    label: "Investments with mutual-fund subtype and cap classification views",
  },
  { icon: BookOpenCheck, label: "Multi-currency display, imports, exports, and visual reports" },
];

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-14 py-4">
      {/* ── Hero ── */}
      <header className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-500/10 border border-blue-300 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-widest">
          About Budget Tracker
        </div>
        <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 dark:from-blue-400 to-emerald-600 dark:to-emerald-400 bg-clip-text text-transparent tracking-tight">
          Budget Tracker
        </h1>
        <p className="text-xl text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl mx-auto">
          An offline-first credit card companion that trusts you — and only you — with your own
          financial data.
        </p>
      </header>

      {/* ── Philosophy ── */}
      <section className="space-y-4">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-500 mb-1">
            Philosophy
          </p>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Built on a simple principle:{" "}
            <span className="bg-gradient-to-r from-emerald-600 dark:from-emerald-400 to-teal-600 dark:to-teal-400 bg-clip-text text-transparent">
              your data stays yours.
            </span>
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">
            The personal finance space is crowded with apps that promise insight in exchange for
            access — to your SMS, your accounts, your habits. Budget Tracker was built from the
            frustration that no such trade should be necessary. Here is what that looks like in
            practice:
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PHILOSOPHY.map(({ icon: Icon, color, bg, title, body }) => (
            <div
              key={title}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              <span
                className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${bg}`}
              >
                <Icon style={{ width: "1.125rem", height: "1.125rem" }} className={color} />
              </span>
              <div>
                <p className={`text-sm font-semibold mb-1.5 ${color}`}>{title}</p>
                <p className="text-xs text-slate-700 dark:text-slate-400 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 md:p-10 space-y-6 relative overflow-hidden shadow-sm dark:shadow-2xl">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-500 mb-1">
            What's inside
          </p>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6">
            Feature highlights
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300"
              >
                <Icon className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Creator ── */}
      <section className="text-center space-y-8">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            The human behind it
          </p>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Meet the Creator
          </h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Budget Tracker is a solo side-project, built out of genuine need and maintained with
            genuine care.
          </p>
        </div>

        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 p-1">
              <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
                <span className="text-3xl font-bold text-white">VP</span>
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-50 dark:border-slate-900 flex items-center justify-center text-red-500 shadow-lg">
              <Heart size={14} fill="currentColor" />
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Vybhav Podala</h3>
            <p className="text-blue-600 dark:text-blue-400 font-medium">Software Engineer</p>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://github.com/pvybhav"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-200 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-300 font-medium hover:bg-slate-300 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all"
            >
              GitHub
            </a>
            <a
              href="mailto:podalavybhav@gmail.com"
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-200 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-300 font-medium hover:bg-slate-300 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all"
            >
              <Mail size={18} />
              Email
            </a>
          </div>
        </div>
      </section>

      <div className="pt-4 text-center pb-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-sm font-medium"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
