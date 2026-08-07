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
    title: "Zero tracking. Not even a little.",
    body: "budget tracker does not read your messages, scrape your bank statements, connect to any server, or collect a single byte of telemetry. There is no backend. There is no account. There is no cloud sync waiting to happen. Every number on this screen was typed in by you, stored in your browser's own IndexedDB, and has never left your device.",
  },
  {
    icon: PenLine,
    color: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/20",
    title: "You are the only source of truth.",
    body: "Most finance apps trade your data for convenience — they read your SMS and auto-fill everything, which sounds great until you realise you've handed a stranger your complete spending history. Budget Tracker makes the opposite trade: you do the logging, you own the data, and in return you get something more valuable than automation — actual awareness of where your money goes.",
  },
  {
    icon: Sparkles,
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/20",
    title: "Daily logging rewires your relationship with money.",
    body: "A 10-second log the moment you spend is one of the highest-leverage financial habits you can build. Not because the data is useful (though it is) — but because the act of recording forces a brief moment of conscious acknowledgement. Do it every day for 30 days. You won't just track spending; you'll start thinking differently before you spend.",
  },
  {
    icon: RefreshCcwDot,
    color: "text-violet-400",
    bg: "bg-violet-400/10 border-violet-400/20",
    title: "Offline-first, always available.",
    body: "Flights, basements, remote cottages — Budget Tracker works everywhere your browser does, because it stores everything locally. No Wi-Fi required after the first load. No loading spinners waiting on a distant API. Your dashboard is as fast and available as your own device.",
  },
];

const FEATURES = [
  { icon: BarChart3, label: "Dynamic available-limit dashboard per card" },
  {
    icon: CalendarCheck,
    label: "Billing-cycle-aware EMI installment tracking",
  },
  {
    icon: BookOpenCheck,
    label: "Category budgets with monthly / yearly modes",
  },
  { icon: DatabaseZap, label: "IndexedDB — 100% local, zero network calls" },
  { icon: ShieldCheck, label: "No account, no server, no data collection" },
  { icon: Sparkles, label: "AMC waiver progress across all your cards" },
];

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-14 py-4">
      {/* ── Hero ── */}
      <header className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest">
          About Budget Tracker
        </div>
        <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent tracking-tight">
          Budget Tracker
        </h1>
        <p className="text-xl text-slate-400 leading-relaxed max-w-xl mx-auto">
          An offline-first credit card companion that trusts you — and only you
          — with your own financial data.
        </p>
      </header>

      {/* ── Philosophy ── */}
      <section className="space-y-4">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">
            Philosophy
          </p>
          <h2 className="text-2xl font-bold text-slate-100">
            Built on a simple principle:{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              your data stays yours.
            </span>
          </h2>
          <p className="mt-3 text-slate-400 leading-relaxed">
            The personal finance space is crowded with apps that promise insight
            in exchange for access — to your SMS, your accounts, your habits.
            Budget Tracker was built from the frustration that no such trade
            should be necessary. Here is what that looks like in practice:
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PHILOSOPHY.map(({ icon: Icon, color, bg, title, body }) => (
            <div
              key={title}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-3 hover:border-slate-700 transition-colors"
            >
              <span
                className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${bg}`}
              >
                <Icon
                  style={{ width: "1.125rem", height: "1.125rem" }}
                  className={color}
                />
              </span>
              <div>
                <p className={`text-sm font-semibold mb-1.5 ${color}`}>
                  {title}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-8 md:p-10 space-y-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">
            What's inside
          </p>
          <h2 className="text-xl font-bold text-slate-100 mb-6">
            Feature highlights
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-start gap-3 text-sm text-slate-300"
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
          <h2 className="text-2xl font-bold text-slate-100">
            Meet the Creator
          </h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Budget Tracker is a solo side-project, built out of genuine need and
            maintained with genuine care.
          </p>
        </div>

        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 p-1">
              <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
                <span className="text-3xl font-bold text-white">VP</span>
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-red-500 shadow-lg">
              <Heart size={14} fill="currentColor" />
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="text-2xl font-bold text-white">Vybhav Podala</h3>
            <p className="text-blue-400 font-medium">Software Engineer</p>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://github.com/pvybhav"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-800/50 border border-slate-700 text-slate-300 font-medium hover:bg-slate-800 hover:text-white transition-all"
            >
              GitHub
            </a>
            <a
              href="mailto:podalavybhav@gmail.com"
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-800/50 border border-slate-700 text-slate-300 font-medium hover:bg-slate-800 hover:text-white transition-all"
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
          className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-400 transition-colors text-sm font-medium"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
