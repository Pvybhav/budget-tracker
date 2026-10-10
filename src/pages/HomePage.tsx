import { useState, useMemo } from "react";
import { useBackendResource } from "../services/backendHooks";
import { CalendarDays, Plus, ShieldCheck, PenLine, Sparkles } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { fetchCards, fetchCategories, fetchExpenses } from "../services/backend.service";
import { forecastAllCategoryBudgets } from "../services/budget-forecast.service";
import { getSmartBudgetRecommendations } from "../services/budget-recommendations.service";
import { compareMonthlyTrends } from "../services/budget-comparison.service";
import { calculateCategoryCarryovers } from "../services/budget-carryover.service";
import { convertCurrency, useDisplayCurrency } from "../services/currency.service";
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
import AddCardModal from "../components/modals/AddCardModal";
import AddExpenseModal from "../components/modals/AddExpenseModal";
import CardThumbnail from "../components/CardThumbnail";
import MonthlySummary from "../components/MonthlySummary";
import DashboardSummary from "../components/DashboardSummary";
import UpcomingExpensesPanel from "../components/UpcomingExpensesPanel";
import IncomeExpenseSummary from "../components/IncomeExpenseSummary";
import PaymentDueAlerts from "../components/PaymentDueAlerts";
import SavingsGoalsSection from "../components/SavingsGoalsSection";
import AlertsPanel from "../components/AlertsPanel";
import NetWorthSummary from "../components/NetWorthSummary";
import BudgetForecastPanel from "../components/BudgetForecastPanel";
import SmartBudgetRecommendationsPanel from "../components/SmartBudgetRecommendationsPanel";
import MonthlyComparisonPanel from "../components/MonthlyComparisonPanel";
import BudgetCarryoverPanel from "../components/BudgetCarryoverPanel";
import CustomBudgetPeriodsDisplay from "../components/CustomBudgetPeriodsDisplay";
import Tooltip from "../components/Tooltip";
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
  const displayCurrency = useDisplayCurrency();
  const cards = useBackendResource(() => fetchCards(), []);
  const categories = useBackendResource(() => fetchCategories(), []);
  const expenses = useBackendResource(() => fetchExpenses(), []);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isDescriptionVisible, setIsDescriptionVisible] = useState(false);
  const budgetForecasts = useMemo(() => {
    if (!categories || !expenses) return [];
    return forecastAllCategoryBudgets(categories, expenses, displayCurrency);
  }, [categories, expenses, displayCurrency]);
  const recommendations = useMemo(() => {
    if (!categories || !expenses) return [];
    return getSmartBudgetRecommendations(categories, expenses, 6, displayCurrency);
  }, [categories, expenses, displayCurrency]);
  const monthlyComparison = useMemo(() => {
    if (!categories || !expenses) return null;
    return compareMonthlyTrends(
      expenses,
      categories,
      new Date().getFullYear(),
      new Date().getMonth(),
      displayCurrency,
    );
  }, [categories, expenses, displayCurrency]);
  const carryovers = useMemo(() => {
    if (!categories || !expenses) return [];
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevMonthStart = new Date(prevYear, prevMonth, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const prevMonthSpent = new Map<string, number>();
    expenses.forEach((exp) => {
      const expDate = new Date(exp.date);
      if (expDate >= prevMonthStart && expDate <= prevMonthEnd) {
        const current = prevMonthSpent.get(exp.categoryId ?? "") ?? 0;
        prevMonthSpent.set(
          exp.categoryId ?? "",
          current + convertCurrency(exp.amount, exp.currency, displayCurrency),
        );
      }
    });
    return calculateCategoryCarryovers(
      categories.map((c) => ({ ...c, enableCarryover: true })),
      prevMonthSpent,
      displayCurrency,
    );
  }, [categories, expenses, displayCurrency]);
  const showBudgetForecastAlerts = false;
  const showFullDescription = !cards || cards.length === 0 || isDescriptionVisible;
  const currentMonth = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(new Date());
  return (
    <div className="space-y-8">
      {/* Header row */}
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 dark:border-slate-800/80 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
            Personal finance
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h1>
          <div className="mt-2 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            <CalendarDays className="h-4 w-4" />
            <span>{currentMonth} overview</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {cards && cards.length > 0 && (
            <Tooltip content={isDescriptionVisible ? "Hide information" : "Show information"}>
              <button
                type="button"
                aria-label={isDescriptionVisible ? "Hide information" : "Show information"}
                aria-pressed={isDescriptionVisible}
                onClick={() => setIsDescriptionVisible(!isDescriptionVisible)}
                className={cn(
                  "rounded-lg border p-2.5 transition-colors",
                  isDescriptionVisible
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-slate-200 bg-white text-slate-500 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-emerald-300",
                )}
              >
                <Sparkles className="h-4 w-4" />
              </button>
            </Tooltip>
          )}
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800 sm:flex-none sm:px-4"
          >
            <Plus className="h-4 w-4" />
            Add expense
          </button>
          <button
            onClick={() => setIsCardModalOpen(true)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:flex-none sm:px-4"
          >
            <Plus className="h-4 w-4" />
            Add card
          </button>
        </div>
      </div>
      <DashboardSummary />
      {/* Monthly cash flow and alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <MonthlySummary /> <IncomeExpenseSummary />
        </div>
        <div className="space-y-4">
          <PaymentDueAlerts /> <AlertsPanel />
        </div>
      </div>
      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Looking ahead
          </p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Coming up</h2>
        </div>
        <div className="space-y-6">
          <UpcomingExpensesPanel />
          <NetWorthSummary />
        </div>
      </section>
      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Make your plan
          </p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Budget planning
          </h2>
        </div>
        {showBudgetForecastAlerts && <BudgetForecastPanel forecasts={budgetForecasts} />}
        {monthlyComparison && <MonthlyComparisonPanel comparison={monthlyComparison} />}
        {(recommendations.length > 0 || carryovers.length > 0) && (
          <details className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800 marker:hidden hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/50">
              <span className="flex items-center justify-between gap-3">
                <span>Smart recommendations &amp; budget carryover</span>
                <span className="text-xs font-normal text-slate-500">Show details</span>
              </span>
            </summary>
            <div className="space-y-4 border-t border-slate-200 p-3 dark:border-slate-800 sm:p-4">
              {recommendations.length > 0 && (
                <SmartBudgetRecommendationsPanel recommendations={recommendations} />
              )}
              {carryovers.length > 0 && <BudgetCarryoverPanel carryovers={carryovers} />}
            </div>
          </details>
        )}
        <CustomBudgetPeriodsDisplay selectedStartDate={1} />
      </section>
      {showFullDescription && (
        <div className="rounded-2xl border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/60 overflow-hidden transition-all duration-500 animate-in fade-in slide-in-from-top-4">
          {/* Top banner */}
          <div className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500 mb-2">
              How Budget Tracker works
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-snug">
              Your money, your data,
              <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
                your rules.
              </span>
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
              Most finance apps quietly help themselves to your data in exchange for convenience.
              Budget Tracker takes the opposite bet — every insight lives entirely on your device,
              powered only by what you choose to log.
            </p>
          </div>
          {/* Three pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
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
                  <p className={`text-sm font-semibold mb-1 ${color}`}> {title} </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <SavingsGoalsSection />
      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Your accounts
          </p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Payment cards
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards?.map((card) => (
            <CardThumbnail key={card.id} card={card} />
          ))}
          {cards?.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white/50 px-5 py-8 text-center dark:border-slate-700 dark:bg-slate-900/30">
              <p className="font-medium text-slate-700 dark:text-slate-200">No cards added yet</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Add a card to keep payment details close to your monthly overview.
              </p>
              <button
                type="button"
                onClick={() => setIsCardModalOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                <Plus className="h-4 w-4" />
                Add a card
              </button>
            </div>
          )}
        </div>
      </section>
      <AddCardModal isOpen={isCardModalOpen} onClose={() => setIsCardModalOpen(false)} />
      <AddExpenseModal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} />
    </div>
  );
}
