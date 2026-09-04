import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, PiggyBank, Receipt, Wallet } from "lucide-react";
import { useBackendResource } from "../services/backendHooks";
import {
  fetchBills,
  fetchExpenses,
  fetchIncomes,
  fetchSavingsGoals,
} from "../services/backend.service";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";

function isCurrentMonth(date: string) {
  const value = new Date(date);
  const now = new Date();
  return value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth();
}

export default function DashboardSummary() {
  const displayCurrency = useDisplayCurrency();
  const expenses = useBackendResource(() => fetchExpenses(), []);
  const incomes = useBackendResource(() => fetchIncomes(), []);
  const bills = useBackendResource(() => fetchBills(), []);
  const savingsGoals = useBackendResource(() => fetchSavingsGoals(), []);
  const summary = useMemo(() => {
    const spent = (expenses ?? []).reduce(
      (total, expense) =>
        total +
        (isCurrentMonth(expense.date)
          ? convertCurrency(expense.amount, expense.currency, displayCurrency)
          : 0),
      0,
    );
    const income = (incomes ?? []).reduce(
      (total, entry) =>
        total +
        (isCurrentMonth(entry.date)
          ? convertCurrency(entry.amount, entry.currency, displayCurrency)
          : 0),
      0,
    );
    const billPayments = (bills ?? []).reduce(
      (total, bill) =>
        total +
        (bill.paid && bill.paidDate && isCurrentMonth(bill.paidDate)
          ? convertCurrency(bill.amount, bill.currency, displayCurrency)
          : 0),
      0,
    );
    const savings = (savingsGoals ?? []).reduce(
      (total, goal) => total + convertCurrency(goal.currentAmount, goal.currency, displayCurrency),
      0,
    );
    return { spent, income, billPayments, savings, remaining: income - spent - billPayments };
  }, [expenses, incomes, bills, savingsGoals, displayCurrency]);

  const metrics = [
    { label: "Spent", value: summary.spent, icon: ArrowDownRight, color: "text-rose-500" },
    { label: "Bill payments", value: summary.billPayments, icon: Receipt, color: "text-amber-500" },
    { label: "Savings", value: summary.savings, icon: PiggyBank, color: "text-cyan-500" },
    {
      label: "Remaining",
      value: summary.remaining,
      icon: Wallet,
      color: summary.remaining >= 0 ? "text-emerald-500" : "text-rose-500",
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/70 p-5 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            This month
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Your money at a glance
          </h2>
        </div>
        {summary.remaining >= 0 ? (
          <ArrowUpRight className="h-5 w-5 text-emerald-500" />
        ) : (
          <ArrowDownRight className="h-5 w-5 text-rose-500" />
        )}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/50"
          >
            <Icon className={`h-4 w-4 ${color}`} />
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{label}</div>
            <div className={`mt-1 text-lg font-semibold ${color}`}>
              {formatMoney(value, displayCurrency)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
