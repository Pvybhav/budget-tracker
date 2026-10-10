import { useMemo } from "react";
import { useBackendResource } from "../services/backendHooks";
import { fetchExpenses, fetchIncomes } from "../services/backend.service";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
import { getBalanceMonthAmountForExpense } from "../services/card.service";
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
export default function IncomeExpenseSummary({ className }: { className?: string }) {
  const displayCurrency = useDisplayCurrency();
  const incomes = useBackendResource(() => fetchIncomes(), []);
  const expenses = useBackendResource(() => fetchExpenses(), []);
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);
  const { incomeThis, expenseThis } = useMemo(() => {
    const incomeThis = (incomes || []).reduce((sum, i) => {
      const d = new Date(i.date);
      return d >= start && d <= end
        ? sum + convertCurrency(i.amount, i.currency, displayCurrency)
        : sum;
    }, 0);
    const expenseThis = (expenses || []).reduce(
      (sum, e) => sum + convertCurrency(getBalanceMonthAmountForExpense(e, start), e.currency, displayCurrency),
      0,
    );
    return { incomeThis, expenseThis };
  }, [incomes, expenses, start, end, displayCurrency]);
  const netSavings = incomeThis - expenseThis;
  const savingsRate = incomeThis > 0 ? Math.round((netSavings / incomeThis) * 100) : 0;
  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 p-4 ${className || ""}`}
    >
      <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        Income vs Expense
      </div>
      <div className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">
        This month's cash flow
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <div>
          <div className="text-sm text-slate-600 dark:text-slate-400">Income</div>
          <div className="text-base font-semibold text-emerald-600 dark:text-emerald-400 sm:text-xl">
            {formatMoney(incomeThis, displayCurrency)}
          </div>
        </div>
        <div>
          <div className="text-sm text-slate-600 dark:text-slate-400">Expense</div>
          <div className="text-base font-semibold text-rose-600 dark:text-rose-400 sm:text-xl">
            {formatMoney(expenseThis, displayCurrency)}
          </div>
        </div>
        <div className="sm:text-right">
          <div className="text-sm text-slate-600 dark:text-slate-400">Net Savings</div>
          <div
            className={`text-base font-semibold sm:text-xl ${netSavings >= 0 ? "text-slate-900 dark:text-slate-100" : "text-rose-600 dark:text-rose-400"}`}
          >
            {formatMoney(netSavings, displayCurrency)}
          </div>
        </div>
      </div>
      <div className="mt-4 text-xs text-slate-600 dark:text-slate-400">
        {incomeThis > 0
          ? `Saving ${savingsRate}% of income this month`
          : "No income recorded yet this month"}
      </div>
    </div>
  );
}
