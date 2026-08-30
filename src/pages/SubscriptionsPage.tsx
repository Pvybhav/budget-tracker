import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { useBackendResource } from "../services/backendHooks";
import { fetchBills } from "../services/backend.service";
import { updateBill } from "../services/backendSync";
export default function SubscriptionsPage() {
  const bills = useBackendResource(() => fetchBills(), []);
  const subscriptions = useMemo(() => (bills ?? []).filter((bill) => bill.isSubscription), [bills]);
  const annualCost = subscriptions.reduce(
    (sum, bill) =>
      sum +
      bill.amount *
        (bill.subscriptionFrequency === "yearly"
          ? 1
          : bill.subscriptionFrequency === "quarterly"
            ? 4
            : 12),
    0,
  );
  const advance = async (id: number, currentDate: string, frequency: string) => {
    const date = new Date(`${currentDate}T00:00:00`);
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
        <h1 className="text-3xl font-semibold text-slate-100">Subscriptions</h1>{" "}
        <p className="mt-1 text-sm text-slate-400">
          {" "}
          Track recurring services, renewal dates, and their yearly cost.{" "}
        </p>{" "}
      </div>{" "}
      <div className="grid gap-3 sm:grid-cols-2">
        {" "}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          {" "}
          <div className="text-sm text-slate-400">Active subscriptions</div>{" "}
          <div className="mt-1 text-2xl font-semibold text-slate-100">
            {" "}
            {subscriptions.length}{" "}
          </div>{" "}
        </div>{" "}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          {" "}
          <div className="text-sm text-slate-400">Estimated yearly cost</div>{" "}
          <div className="mt-1 text-2xl font-semibold text-amber-300">
            {" "}
            ₹{annualCost.toLocaleString("en-IN", { maximumFractionDigits: 2 })}{" "}
          </div>{" "}
        </div>{" "}
      </div>{" "}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {" "}
        {subscriptions.map((bill) => (
          <article key={bill.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            {" "}
            <div className="flex items-start justify-between gap-3">
              {" "}
              <div>
                {" "}
                <h2 className="font-semibold text-slate-100">{bill.name}</h2>{" "}
                <p className="text-sm text-slate-500"> {bill.provider || "Subscription"} </p>{" "}
              </div>{" "}
              <RefreshCw className="h-5 w-5 text-emerald-400" />{" "}
            </div>{" "}
            <p className="mt-5 text-2xl font-semibold text-slate-100">
              {" "}
              ₹ {bill.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}{" "}
            </p>{" "}
            <p className="mt-1 text-sm capitalize text-slate-400">
              {" "}
              {bill.subscriptionFrequency || "monthly"} renewal{" "}
            </p>{" "}
            <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-4 text-sm">
              {" "}
              <span className="text-slate-400">
                {" "}
                Next: {new Date(`${bill.dueDate}T00:00:00`).toLocaleDateString()}{" "}
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
          <div className="rounded-2xl border border-dashed border-slate-700 p-10 text-center text-slate-500 md:col-span-2 lg:col-span-3">
            {" "}
            No subscriptions yet. Add a bill and enable recurring subscription tracking.{" "}
          </div>
        )}{" "}
      </div>{" "}
    </div>
  );
}
