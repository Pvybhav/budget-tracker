import { useState } from "react";
import { CheckCircle2, CircleDollarSign } from "lucide-react";
import type { Investment } from "../db/db";
import { useBackendResource } from "../services/backendHooks";
import { fetchInvestments } from "../services/backend.service";
import {
  createInvestmentTransaction,
  deleteInvestmentTransaction,
  updateInvestment,
} from "../services/backendSync";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
import { formatDateOnly, todayDateInput } from "../utils/date";
import { showAlert } from "./Confirm";

function dateForDueDay(year: number, month: number, dueDay: number) {
  const day = Math.min(dueDay, new Date(year, month + 1, 0).getDate());
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function UpcomingSipsSection() {
  const displayCurrency = useDisplayCurrency();
  const investments = useBackendResource(() => fetchInvestments(), []);
  const [savingId, setSavingId] = useState<string>();
  const now = new Date();
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = nextMonthDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const plannedSips = (investments ?? [])
    .filter(
      (investment) =>
        investment.id &&
        investment.sipAmount != null &&
        investment.sipAmount > 0 &&
        investment.sipDueDay != null,
    )
    .sort((left, right) => left.sipDueDay! - right.sipDueDay!);
  const total = plannedSips.reduce(
    (sum, investment) =>
      sum + convertCurrency(investment.sipAmount!, investment.currency, displayCurrency),
    0,
  );

  const markPaid = async (investment: Investment) => {
    if (!investment.id || !investment.sipAmount || savingId) return;
    setSavingId(investment.id);
    try {
      const transaction = await createInvestmentTransaction({
        investmentId: investment.id,
        type: "buy",
        amount: investment.sipAmount,
        date: todayDateInput(),
        note: `Monthly SIP · ${monthLabel}`,
        currency: investment.currency,
      });
      try {
        await updateInvestment(investment.id, { sipLastPaidMonth: nextMonth });
      } catch (error) {
        if (transaction.id) {
          try {
            await deleteInvestmentTransaction(transaction.id);
          } catch (rollbackError) {
            throw new Error(
              `SIP payment was recorded but its schedule could not be updated or rolled back: ${rollbackError instanceof Error ? rollbackError.message : "unknown error"}`,
              { cause: error },
            );
          }
        }
        throw error;
      }
    } catch (error) {
      await showAlert(error instanceof Error ? error.message : "Unable to mark this SIP as paid.", {
        title: "Could not update SIP",
      });
    } finally {
      setSavingId(undefined);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Upcoming SIPs
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{monthLabel}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500 dark:text-slate-400">Planned total</div>
          <div className="font-semibold text-slate-900 dark:text-slate-100">
            {formatMoney(total, displayCurrency)}
          </div>
        </div>
      </div>
      {plannedSips.length > 0 ? (
        <ul className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
          {plannedSips.map((investment) => {
            const dueDate = dateForDueDay(
              nextMonthDate.getFullYear(),
              nextMonthDate.getMonth(),
              investment.sipDueDay!,
            );
            const convertedAmount = convertCurrency(
              investment.sipAmount!,
              investment.currency,
              displayCurrency,
            );
            return (
              <li
                key={investment.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {investment.name}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Due {formatDateOnly(dueDate)} · {formatMoney(convertedAmount, displayCurrency)}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={savingId !== undefined || investment.sipLastPaidMonth === nextMonth}
                  onClick={() => void markPaid(investment)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {savingId === investment.id
                    ? "Saving..."
                    : investment.sipLastPaidMonth === nextMonth
                      ? "Paid"
                      : "Mark paid"}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700">
          No SIPs scheduled for {monthLabel}. Add monthly SIP details to an investment to track it
          here.
        </p>
      )}
    </section>
  );
}
