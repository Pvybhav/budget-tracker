import { useMemo } from "react";
import { useBackendResource } from "../services/backendHooks";
import { fetchExpenses, fetchPayments } from "../services/backend.service";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export default function MonthlySummary({ className }: { className?: string }) {
  const expenses = useBackendResource(() => fetchExpenses(), []);
  const payments = useBackendResource(() => fetchPayments(), []);

  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);

  const { spentThis, paidThis, spentLast } = useMemo(() => {
    const spentThis = (expenses || []).reduce((sum, e) => {
      const d = new Date(e.date);
      if (d >= start && d <= end) return sum + e.amount;
      return sum;
    }, 0);

    const paidThis = (payments || []).reduce((sum, p) => {
      const d = new Date(p.date);
      if (d >= start && d <= end) return sum + p.amount;
      return sum;
    }, 0);

    const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
    const prevEnd = new Date(
      start.getFullYear(),
      start.getMonth(),
      0,
      23,
      59,
      59,
      999,
    );
    const spentLast = (expenses || []).reduce((sum, e) => {
      const d = new Date(e.date);
      if (d >= prevStart && d <= prevEnd) return sum + e.amount;
      return sum;
    }, 0);

    return { spentThis, paidThis, spentLast };
  }, [expenses, payments, start, end]);

  const net = Math.max(0, spentThis - paidThis);

  const pctChange =
    spentLast === 0
      ? 0
      : Math.round(((spentThis - spentLast) / spentLast) * 100);

  return (
    <div
      className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-5 ${className || ""}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Monthly Summary
          </div>
          <div className="text-lg font-bold text-slate-100">
            Spending at a glance
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="col-span-1">
          <div className="text-sm text-slate-400">Spent</div>
          <div className="text-xl font-semibold text-rose-400">
            ₹
            {spentThis.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
        <div className="col-span-1">
          <div className="text-sm text-slate-400">Paid</div>
          <div className="text-xl font-semibold text-emerald-400">
            ₹
            {paidThis.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
        <div className="col-span-1 text-right">
          <div className="text-sm text-slate-400">Net</div>
          <div className="text-xl font-semibold text-slate-100">
            ₹
            {net.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs text-slate-400">
        {spentLast !== 0
          ? `${pctChange >= 0 ? "↑" : "↓"} ${Math.abs(pctChange)}% vs last month`
          : "No data for previous month"}
      </div>
    </div>
  );
}
