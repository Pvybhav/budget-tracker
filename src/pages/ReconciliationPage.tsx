import { useMemo, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { useBackendResource } from "../services/backendHooks";
import { fetchCards, fetchExpenses } from "../services/backend.service";
import { updateExpense } from "../services/backendSync";
export default function ReconciliationPage() {
  const expenses = useBackendResource(() => fetchExpenses(), []);
  const cards = useBackendResource(() => fetchCards(), []);
  const [accountId, setAccountId] = useState("all");
  const pending = useMemo(
    () =>
      [...(expenses ?? [])]
        .filter((expense) => accountId === "all" || expense.cardId === Number(accountId))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [accountId, expenses],
  );
  const reconciledTotal = pending
    .filter((expense) => expense.reconciled)
    .reduce((sum, expense) => sum + expense.amount, 0);
  const pendingTotal = pending
    .filter((expense) => !expense.reconciled)
    .reduce((sum, expense) => sum + expense.amount, 0);
  const accountName = (id: number) =>
    cards?.find((card) => card.id === id)?.title ?? `Account #${id}`;
  const markAllVerified = async () => {
    await Promise.all(
      pending
        .filter((expense) => !expense.reconciled && expense.id != null)
        .map((expense) => updateExpense(expense.id!, { reconciled: true })),
    );
  };
  return (
    <div className="space-y-6">
      {" "}
      <div>
        {" "}
        <h1 className="text-3xl font-semibold text-slate-100"> Reconciliation </h1>{" "}
        <p className="mt-1 text-sm text-slate-400">
          {" "}
          Mark transactions that you have verified against your statement.{" "}
        </p>{" "}
      </div>{" "}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-end sm:justify-between">
        {" "}
        <label className="block text-sm text-slate-400">
          {" "}
          Account{" "}
          <select
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white sm:w-64"
          >
            {" "}
            <option value="all">All accounts</option>{" "}
            {cards?.map((card) => (
              <option key={card.id} value={card.id}>
                {" "}
                {card.title}{" "}
              </option>
            ))}{" "}
          </select>{" "}
        </label>{" "}
        <button
          type="button"
          onClick={markAllVerified}
          disabled={!pending.some((expense) => !expense.reconciled)}
          className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {" "}
          Mark visible as verified{" "}
        </button>{" "}
      </div>{" "}
      <div className="grid gap-3 sm:grid-cols-3">
        {" "}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          {" "}
          <div className="text-sm text-slate-400">Transactions</div>{" "}
          <div className="mt-1 text-2xl font-semibold text-slate-100"> {pending.length} </div>{" "}
        </div>{" "}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          {" "}
          <div className="text-sm text-slate-400">Verified spending</div>{" "}
          <div className="mt-1 text-2xl font-semibold text-emerald-300">
            {" "}
            ₹{reconciledTotal.toLocaleString("en-IN")}{" "}
          </div>{" "}
        </div>{" "}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          {" "}
          <div className="text-sm text-slate-400">To verify</div>{" "}
          <div className="mt-1 text-2xl font-semibold text-amber-300">
            {" "}
            ₹{pendingTotal.toLocaleString("en-IN")}{" "}
          </div>{" "}
        </div>{" "}
      </div>{" "}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        {" "}
        <table className="w-full min-w-[620px] text-left text-slate-300">
          {" "}
          <thead className="bg-slate-800/50">
            {" "}
            <tr>
              {" "}
              <th className="px-5 py-4">Status</th> <th className="px-5 py-4">Date</th>{" "}
              <th className="px-5 py-4">Account</th> <th className="px-5 py-4">Description</th>{" "}
              <th className="px-5 py-4">Amount</th>{" "}
            </tr>{" "}
          </thead>{" "}
          <tbody className="divide-y divide-slate-800/60">
            {" "}
            {pending.map((expense) => (
              <tr key={expense.id} className="hover:bg-slate-800/20">
                {" "}
                <td className="px-5 py-3">
                  {" "}
                  <button
                    onClick={() =>
                      expense.id != null &&
                      updateExpense(expense.id, { reconciled: !expense.reconciled })
                    }
                    className={expense.reconciled ? "text-emerald-400" : "text-slate-500"}
                    title={expense.reconciled ? "Mark as unverified" : "Mark as verified"}
                  >
                    {" "}
                    {expense.reconciled ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}{" "}
                  </button>{" "}
                </td>{" "}
                <td className="px-5 py-3"> {new Date(expense.date).toLocaleDateString()} </td>{" "}
                <td className="px-5 py-3">{accountName(expense.cardId)}</td>{" "}
                <td className="px-5 py-3"> {expense.details || "Uncategorized expense"} </td>{" "}
                <td className="px-5 py-3 font-medium">
                  {" "}
                  ₹ {expense.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}{" "}
                </td>{" "}
              </tr>
            ))}{" "}
            {pending.length === 0 && (
              <tr>
                {" "}
                <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                  {" "}
                  No expenses to reconcile.{" "}
                </td>{" "}
              </tr>
            )}{" "}
          </tbody>{" "}
        </table>{" "}
      </div>{" "}
    </div>
  );
}
