import { useState } from "react";
import { CalendarPlus, Trash2 } from "lucide-react";
import type { SavingsContribution, SavingsGoal } from "../db/db";
import { useBackendResource } from "../services/backendHooks";
import { createSavingsContribution, deleteSavingsContribution } from "../services/backendSync";
import { fetchSavingsContributions } from "../services/backend.service";
import showConfirm from "./Confirm";
import { convertCurrency, formatMoney, getDisplayCurrency } from "../services/currency.service";

interface Props {
  goal: SavingsGoal;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function SavingsContributionPanel({ goal }: Props) {
  const contributions = useBackendResource(
    () => (goal.id ? fetchSavingsContributions(goal.id) : Promise.resolve([])),
    [goal.id],
  );
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [frequency, setFrequency] = useState<"none" | "weekly" | "monthly" | "yearly">("none");
  const [interval, setInterval] = useState("1");
  const [endDate, setEndDate] = useState("");
  const displayCurrency = getDisplayCurrency();

  const reset = () => {
    setAmount("");
    setDate(today());
    setNote("");
    setFrequency("none");
    setInterval("1");
    setEndDate("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!goal.id) return;
    const numericAmount = Number.parseFloat(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return;
    await createSavingsContribution(goal.id, {
      amount: numericAmount,
      date,
      note: note.trim() || undefined,
      ...(frequency !== "none"
        ? {
            recurringFrequency: frequency,
            recurringInterval: Math.max(1, Number.parseInt(interval, 10) || 1),
            recurringEndDate: endDate || undefined,
          }
        : {}),
      currency: goal.currency ?? displayCurrency,
    });
    reset();
    setIsOpen(false);
  };

  const handleDelete = async (contribution: SavingsContribution) => {
    if (!goal.id || !contribution.id) return;
    const ok = await showConfirm("Delete this contribution? Goal progress will be adjusted.", {
      title: "Delete contribution",
      confirmText: "Delete",
    });
    if (ok) await deleteSavingsContribution(goal.id, contribution.id);
  };

  return (
    <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Contribution history
          </h4>
          <p className="text-xs text-slate-500">
            {contributions?.length ?? 0} recorded contribution
            {contributions?.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <CalendarPlus className="h-4 w-4" /> Add contribution
        </button>
      </div>
      {contributions && contributions.length > 0 && (
        <div className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {contributions.map((contribution) => (
            <div
              key={contribution.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <div>
                <span className="text-slate-600 dark:text-slate-400">{contribution.date}</span>
                {contribution.note && (
                  <span className="ml-2 text-slate-500">{contribution.note}</span>
                )}
                {contribution.recurringFrequency && (
                  <span className="ml-2 text-xs text-cyan-600 dark:text-cyan-400">
                    Every {contribution.recurringInterval ?? 1} {contribution.recurringFrequency}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {formatMoney(
                    convertCurrency(contribution.amount, contribution.currency, displayCurrency),
                    displayCurrency,
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(contribution)}
                  className="text-slate-500 hover:text-rose-500"
                  title="Delete contribution"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Add contribution
                </h2>
                <p className="mt-1 text-sm text-slate-500">{goal.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-500"
                title="Close"
              >
                Close
              </button>
            </div>
            <label className="block text-sm text-slate-600 dark:text-slate-400">
              Amount
              <input
                required
                min="0.01"
                step="0.01"
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
            <label className="block text-sm text-slate-600 dark:text-slate-400">
              Date
              <input
                required
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
            <label className="block text-sm text-slate-600 dark:text-slate-400">
              Recurring contribution
              <select
                value={frequency}
                onChange={(event) => setFrequency(event.target.value as typeof frequency)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="none">One time</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>
            {frequency !== "none" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm text-slate-600 dark:text-slate-400">
                  Every
                  <input
                    required
                    min="1"
                    type="number"
                    value={interval}
                    onChange={(event) => setInterval(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>
                <label className="block text-sm text-slate-600 dark:text-slate-400">
                  End date
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>
              </div>
            )}
            <label className="block text-sm text-slate-600 dark:text-slate-400">
              Note
              <input
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Save contribution
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
