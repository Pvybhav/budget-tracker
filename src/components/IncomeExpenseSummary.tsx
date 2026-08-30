import { useMemo } from "react";
import { useBackendResource } from "../services/backendHooks";
import { fetchExpenses, fetchIncomes } from "../services/backend.service";
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export default function IncomeExpenseSummary({ className }: { className?: string }) {
  const incomes = useBackendResource(() => fetchIncomes(), []);
  const expenses = useBackendResource(() => fetchExpenses(), []);
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);
  const { incomeThis, expenseThis } = useMemo(() => {
    const incomeThis = (incomes || []).reduce((sum, i) => {
      const d = new Date(i.date);
      return d >= start && d <= end ? sum + i.amount : sum;
    }, 0);
    const expenseThis = (expenses || []).reduce((sum, e) => {
      const d = new Date(e.date);
      return d >= start && d <= end ? sum + e.amount : sum;
    }, 0);
    return { incomeThis, expenseThis };
  }, [incomes, expenses, start, end]);
  const netSavings = incomeThis - expenseThis;
  const savingsRate = incomeThis > 0 ? Math.round((netSavings / incomeThis) * 100) : 0;
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-5 ${className || ""}`}>
      {" "}
      <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        {" "}
        Income vs Expense{" "}
      </div>{" "}
      <div className="text-lg font-bold text-slate-100 mb-4"> This month's cash flow </div>{" "}
      <div className="grid grid-cols-3 gap-4">
        {" "}
        <div>
          {" "}
          <div className="text-sm text-slate-400">Income</div>{" "}
          <div className="text-xl font-semibold text-emerald-400"> ₹{fmt(incomeThis)} </div>{" "}
        </div>{" "}
        <div>
          {" "}
          <div className="text-sm text-slate-400">Expense</div>{" "}
          <div className="text-xl font-semibold text-rose-400"> ₹{fmt(expenseThis)} </div>{" "}
        </div>{" "}
        <div className="text-right">
          {" "}
          <div className="text-sm text-slate-400">Net Savings</div>{" "}
          <div
            className={`text-xl font-semibold ${netSavings >= 0 ? "text-slate-100" : "text-rose-400"}`}
          >
            {" "}
            ₹{fmt(netSavings)}{" "}
          </div>{" "}
        </div>{" "}
      </div>{" "}
      <div className="mt-4 text-xs text-slate-400">
        {" "}
        {incomeThis > 0
          ? `Saving ${savingsRate}% of income this month`
          : "No income recorded yet this month"}{" "}
      </div>{" "}
    </div>
  );
}
