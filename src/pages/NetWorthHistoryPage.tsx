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
import { formatDateOnly } from "../utils/date";
import { createNetWorthSnapshot } from "../services/backendSync";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
export default function NetWorthHistoryPage() {
  const displayCurrency = useDisplayCurrency();
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
        .reduce(
          (sum, item) => sum + convertCurrency(item.amount, item.currency, displayCurrency),
          0,
        );
      const outgoing = transfers
        .filter((item) => item.fromAccountId === card.id)
        .reduce(
          (sum, item) => sum + convertCurrency(item.amount, item.currency, displayCurrency),
          0,
        );
      return (
        total +
        (card.type === "credit"
          ? 0
          : convertCurrency(metrics.currentBalance, card.currency, displayCurrency) +
            incoming -
            outgoing)
      );
    }, 0);
    const creditDebt = cards.reduce(
      (total, card) =>
        card.type === "credit"
          ? total +
            convertCurrency(
              getCardMetrics(card, expenses, payments, cards).amountOwed ?? 0,
              card.currency,
              displayCurrency,
            )
          : total,
      0,
    );
    const assets =
      accountValue +
      investments.reduce(
        (sum, item) => sum + convertCurrency(item.currentValue, item.currency, displayCurrency),
        0,
      ) +
      savings.reduce(
        (sum, item) => sum + convertCurrency(item.currentAmount, item.currency, displayCurrency),
        0,
      );
    const liabilities =
      creditDebt +
      loans.reduce(
        (sum, loan) =>
          sum + convertCurrency(getLoanRemainingBalance(loan), loan.currency, displayCurrency),
        0,
      );
    return { assets, liabilities, netWorth: assets - liabilities };
  }, [cards, expenses, investments, loans, payments, savings, transfers, displayCurrency]);
  const saveSnapshot = async () => {
    if (!current) return;
    await createNetWorthSnapshot({
      assets: current.assets,
      liabilities: current.liabilities,
      date: new Date().toISOString().slice(0, 10),
      currency: displayCurrency,
    });
  };
  const chartData = (snapshots ?? []).map((item) => ({
    ...item,
    label: formatDateOnly(item.date),
  }));
  return (
    <div className="space-y-6">
      {" "}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        {" "}
        <div>
          {" "}
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            {" "}
            Net Worth History{" "}
          </h1>{" "}
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
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
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-500/5">
            {" "}
            <div className="text-sm text-slate-600 dark:text-slate-400">Assets</div>{" "}
            <div className="mt-1 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">
              {" "}
              {formatMoney(current.assets, displayCurrency)}{" "}
            </div>{" "}
          </div>{" "}
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm dark:border-rose-500/20 dark:bg-rose-500/5">
            {" "}
            <div className="text-sm text-slate-600 dark:text-slate-400">Liabilities</div>{" "}
            <div className="mt-1 text-2xl font-semibold text-rose-700 dark:text-rose-300">
              {" "}
              {formatMoney(current.liabilities, displayCurrency)}{" "}
            </div>{" "}
          </div>{" "}
          <div className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            {" "}
            <div className="text-sm text-slate-600 dark:text-slate-400">Net worth</div>{" "}
            <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {" "}
              {formatMoney(current.netWorth, displayCurrency)}{" "}
            </div>{" "}
          </div>{" "}
        </div>
      )}{" "}
      {chartData.length > 1 && (
        <div className="h-80 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {" "}
          <h2 className="mb-4 font-semibold text-slate-900 dark:text-slate-100">
            Net worth trend
          </h2>{" "}
          <ResponsiveContainer width="100%" height="90%">
            {" "}
            <LineChart data={chartData}>
              {" "}
              <XAxis dataKey="label" stroke="#94a3b8" /> <YAxis stroke="#94a3b8" />{" "}
              <Tooltip formatter={(value) => formatMoney(Number(value), displayCurrency)} />{" "}
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
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-100 p-10 text-center text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-500">
          {" "}
          Save another snapshot next month to see the trend chart.{" "}
        </div>
      )}{" "}
    </div>
  );
}
