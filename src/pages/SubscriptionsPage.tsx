import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { useBackendResource } from "../services/backendHooks";
import { fetchBills } from "../services/backend.service";
import { updateBill } from "../services/backendSync";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
import { formatDateOnly, parseDateOnly } from "../utils/date";
export default function SubscriptionsPage() {
  const displayCurrency = useDisplayCurrency();
  const bills = useBackendResource(() => fetchBills(), []);
  const subscriptions = useMemo(() => (bills ?? []).filter((bill) => bill.isSubscription), [bills]);
  const annualCost = subscriptions.reduce(
    (sum, bill) =>
      sum +
      convertCurrency(bill.amount, bill.currency, displayCurrency) *
        (bill.subscriptionFrequency === "yearly"
          ? 1
          : bill.subscriptionFrequency === "quarterly"
            ? 4
            : 12),
    0,
  );
  const advance = async (id: string, currentDate: string, frequency: string) => {
    const date = parseDateOnly(currentDate);
    if (!date) return;
    date.setMonth(
      date.getMonth() + (frequency === "yearly" ? 12 : frequency === "quarterly" ? 3 : 1),
    );
    await updateBill(id, { dueDate: date.toISOString().slice(0, 10), paid: false });
  };
  return (
    <div className="space-y-6">
      {" "}
      <div>
        {" "}
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          Subscriptions
        </h1>{" "}
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {" "}
          Track recurring services, renewal dates, and their yearly cost.{" "}
        </p>{" "}
      </div>{" "}
      <div className="grid gap-3 sm:grid-cols-2">
        {" "}
        <div className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          {" "}
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Active subscriptions
          </div>{" "}
          <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {" "}
            {subscriptions.length}{" "}
          </div>{" "}
        </div>{" "}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/5">
          {" "}
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Estimated yearly cost
          </div>{" "}
          <div className="mt-1 text-2xl font-semibold text-amber-700 dark:text-amber-300">
            {" "}
            {formatMoney(annualCost, displayCurrency)}{" "}
          </div>{" "}
        </div>{" "}
      </div>{" "}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {" "}
        {subscriptions.map((bill) => (
          <article
            key={bill.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            {" "}
            <div className="flex items-start justify-between gap-3">
              {" "}
              <div>
                {" "}
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                  {bill.name}
                </h2>{" "}
                <p className="text-sm text-slate-500"> {bill.provider || "Subscription"} </p>{" "}
              </div>{" "}
              <RefreshCw className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />{" "}
            </div>{" "}
            <p className="mt-5 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {" "}
              {formatMoney(
                convertCurrency(bill.amount, bill.currency, displayCurrency),
                displayCurrency,
              )}{" "}
            </p>{" "}
            <p className="mt-1 text-sm capitalize text-slate-600 dark:text-slate-400">
              {" "}
              {bill.subscriptionFrequency || "monthly"} renewal{" "}
            </p>{" "}
            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
              {" "}
              <span className="text-slate-600 dark:text-slate-400">
                {" "}
                Next: {formatDateOnly(bill.dueDate)}{" "}
              </span>{" "}
              {bill.id != null && (
                <button
                  onClick={() =>
                    advance(bill.id!, bill.dueDate, bill.subscriptionFrequency || "monthly")
                  }
                  className="text-emerald-300 hover:text-emerald-200"
                >
                  {" "}
                  Mark renewed{" "}
                </button>
              )}{" "}
            </div>{" "}
          </article>
        ))}{" "}
        {subscriptions.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-100 p-10 text-center text-slate-600 md:col-span-2 lg:col-span-3 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-500">
            {" "}
            No subscriptions yet. Add a bill and enable recurring subscription tracking.{" "}
          </div>
        )}{" "}
      </div>{" "}
    </div>
  );
}
