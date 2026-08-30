import { useMemo } from "react";
import { Save } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useBackendResource } from "../services/backendHooks";
import {
  fetchCards,
  fetchExpenses,
  fetchInvestments,
  fetchLoans,
  fetchPayments,
  fetchSavingsGoals,
  fetchTransfers,
  fetchNetWorthSnapshots,
} from "../services/backend.service";
import { getCardMetrics } from "../services/card.service";
import { getLoanRemainingBalance } from "../services/netWorth.service";
import { createNetWorthSnapshot } from "../services/backendSync";
const money = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
export default function NetWorthHistoryPage() {
  const cards = useBackendResource(() => fetchCards(), []);
  const expenses = useBackendResource(() => fetchExpenses(), []);
  const payments = useBackendResource(() => fetchPayments(), []);
  const transfers = useBackendResource(() => fetchTransfers(), []);
  const investments = useBackendResource(() => fetchInvestments(), []);
  const loans = useBackendResource(() => fetchLoans(), []);
  const savings = useBackendResource(() => fetchSavingsGoals(), []);
  const snapshots = useBackendResource(() => fetchNetWorthSnapshots(), []);
  const current = useMemo(() => {
    if (!cards || !expenses || !payments || !transfers || !investments || !loans || !savings)
      return null;
    const accountValue = cards.reduce((total, card) => {
      const metrics = getCardMetrics(card, expenses, payments, cards);
      const incoming = transfers
        .filter((item) => item.toAccountId === card.id)
        .reduce((sum, item) => sum + item.amount, 0);
      const outgoing = transfers
        .filter((item) => item.fromAccountId === card.id)
        .reduce((sum, item) => sum + item.amount, 0);
      return total + (card.type === "credit" ? 0 : metrics.currentBalance + incoming - outgoing);
    }, 0);
    const creditDebt = cards.reduce(
      (total, card) =>
        card.type === "credit"
          ? total + getCardMetrics(card, expenses, payments, cards).currentBalance
          : total,
      0,
    );
    const assets =
      accountValue +
      investments.reduce((sum, item) => sum + item.currentValue, 0) +
      savings.reduce((sum, item) => sum + item.currentAmount, 0);
    const liabilities =
      creditDebt + loans.reduce((sum, loan) => sum + getLoanRemainingBalance(loan), 0);
    return { assets, liabilities, netWorth: assets - liabilities };
  }, [cards, expenses, investments, loans, payments, savings, transfers]);
  const saveSnapshot = async () => {
    if (!current) return;
    await createNetWorthSnapshot({
      assets: current.assets,
      liabilities: current.liabilities,
      date: new Date().toISOString().slice(0, 10),
    });
  };
  const chartData = (snapshots ?? []).map((item) => ({
    ...item,
    label: new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    }),
  }));
  return (
    <div className="space-y-6">
      {" "}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        {" "}
        <div>
          {" "}
          <h1 className="text-3xl font-semibold text-slate-100"> Net Worth History </h1>{" "}
          <p className="mt-1 text-sm text-slate-400">
            {" "}
            Capture monthly snapshots of your assets and liabilities.{" "}
          </p>{" "}
        </div>{" "}
        <button
          onClick={saveSnapshot}
          disabled={!current}
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {" "}
          <Save className="h-4 w-4" /> Save current snapshot{" "}
        </button>{" "}
      </div>{" "}
      {current && (
        <div className="grid gap-3 sm:grid-cols-3">
          {" "}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            {" "}
            <div className="text-sm text-slate-400">Assets</div>{" "}
            <div className="mt-1 text-2xl font-semibold text-emerald-300">
              {" "}
              {money(current.assets)}{" "}
            </div>{" "}
          </div>{" "}
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
            {" "}
            <div className="text-sm text-slate-400">Liabilities</div>{" "}
            <div className="mt-1 text-2xl font-semibold text-rose-300">
              {" "}
              {money(current.liabilities)}{" "}
            </div>{" "}
          </div>{" "}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            {" "}
            <div className="text-sm text-slate-400">Net worth</div>{" "}
            <div className="mt-1 text-2xl font-semibold text-slate-100">
              {" "}
              {money(current.netWorth)}{" "}
            </div>{" "}
          </div>{" "}
        </div>
      )}{" "}
      {chartData.length > 1 && (
        <div className="h-80 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          {" "}
          <h2 className="mb-4 font-semibold text-slate-100">Net worth trend</h2>{" "}
          <ResponsiveContainer width="100%" height="90%">
            {" "}
            <LineChart data={chartData}>
              {" "}
              <XAxis dataKey="label" stroke="#94a3b8" /> <YAxis stroke="#94a3b8" />{" "}
              <Tooltip formatter={(value) => money(Number(value))} />{" "}
              <Line
                type="monotone"
                dataKey="netWorth"
                stroke="#34d399"
                strokeWidth={3}
                dot={{ r: 4 }}
              />{" "}
            </LineChart>{" "}
          </ResponsiveContainer>{" "}
        </div>
      )}{" "}
      {chartData.length <= 1 && (
        <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center text-slate-500">
          {" "}
          Save another snapshot next month to see the trend chart.{" "}
        </div>
      )}{" "}
    </div>
  );
}
