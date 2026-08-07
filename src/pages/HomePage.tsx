import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ShieldCheck, PenLine, Sparkles } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
import { db } from "../db/db";
import AddCardModal from "../components/modals/AddCardModal";
import AddExpenseModal from "../components/modals/AddExpenseModal";
import CardThumbnail from "../components/CardThumbnail";
import MonthlySummary from "../components/MonthlySummary";
import PaymentDueAlerts from "../components/PaymentDueAlerts";
import SavingsGoalsSection from "../components/SavingsGoalsSection";

const HERO_POINTS = [
  {
    icon: ShieldCheck,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/20",
    title: "Zero tracking. Seriously.",
    body: "Budget Tracker doesn't peek at your bank SMS, scrape your statements, or phone home to any server. Every number you see here came straight from your own fingers — no background magic, no silent data collection, ever.",
  },
  {
    icon: PenLine,
    color: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/20",
    title: "You are the source of truth.",
    body: "Think of this as your financial journal. The accuracy of every insight — limits, EMIs, category budgets, billing cycles — is entirely in your hands. Garbage in, garbage out; gold in, gold out.",
  },
  {
    icon: Sparkles,
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/20",
    title: "Daily logging builds real habits.",
    body: "Logging expenses the moment they happen takes 10 seconds and rewires how your brain relates to money. Do it consistently for 30 days and you won't need to — you'll already know your spending patterns by heart.",
  },
] as const;

export default function HomePage() {
  const cards = useLiveQuery(() => db.cards.toArray());
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isDescriptionVisible, setIsDescriptionVisible] = useState(false);

  const showFullDescription =
    !cards || cards.length === 0 || isDescriptionVisible;

  return (
    <div className="space-y-8">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold text-slate-100">Dashboard</h1>
        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-colors flex-1 sm:flex-none"
          >
            Add Expense
          </button>
          <button
            onClick={() => setIsCardModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-colors flex-1 sm:flex-none"
          >
            Add New Card
          </button>
        </div>
      </div>

      {/* Description toggle icon (only if cards exist) */}
      {cards && cards.length > 0 && (
        <div className="flex justify-center -mb-4">
          <button
            onClick={() => setIsDescriptionVisible(!isDescriptionVisible)}
            className={cn(
              "p-2 rounded-full transition-all duration-500 group",
              isDescriptionVisible
                ? "bg-slate-800 text-emerald-400 rotate-180"
                : "bg-slate-900 text-slate-400 hover:text-emerald-400 glow-pulse",
            )}
            title={isDescriptionVisible ? "Hide info" : "Show info"}
          >
            <Sparkles className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Hero section */}
      {/* Summary & alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <MonthlySummary />
        </div>
        <div>
          <PaymentDueAlerts />
        </div>
      </div>
      {showFullDescription && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden transition-all duration-500 animate-in fade-in slide-in-from-top-4">
          {/* Top banner */}
          <div className="px-6 pt-6 pb-4 border-b border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
              How Budget Tracker works
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100 leading-snug">
              Your money, your data,{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                your rules.
              </span>
            </h2>
            <p className="mt-2 text-sm text-slate-400 max-w-2xl leading-relaxed">
              Most finance apps quietly help themselves to your data in exchange
              for convenience. Budget Tracker takes the opposite bet — every
              insight lives entirely on your device, powered only by what you
              choose to log.
            </p>
          </div>

          {/* Three pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
            {HERO_POINTS.map(({ icon: Icon, color, bg, title, body }) => (
              <div key={title} className="p-5 flex flex-col gap-3">
                <span
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${bg}`}
                >
                  <Icon
                    className={`w-4.5 h-4.5 ${color}`}
                    style={{ width: "1.125rem", height: "1.125rem" }}
                  />
                </span>
                <div>
                  <p className={`text-sm font-semibold mb-1 ${color}`}>
                    {title}
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <SavingsGoalsSection />

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards?.map((card) => (
          <CardThumbnail key={card.id} card={card} />
        ))}
        {cards?.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400">
            No cards added yet. Click "Add New Card" to get started.
          </div>
        )}
      </div>

      <AddCardModal
        isOpen={isCardModalOpen}
        onClose={() => setIsCardModalOpen(false)}
      />
      <AddExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
      />
    </div>
  );
}
