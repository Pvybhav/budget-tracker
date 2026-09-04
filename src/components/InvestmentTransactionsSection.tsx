import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { InvestmentTransaction, InvestmentTransactionType } from "../db/db";
import { useBackendResource } from "../services/backendHooks";
import { fetchInvestmentTransactions, fetchInvestments } from "../services/backend.service";
import { createInvestmentTransaction, deleteInvestmentTransaction } from "../services/backendSync";
import showConfirm from "../components/Confirm";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
import { formatDateOnly, todayDateInput } from "../utils/date";
export default function InvestmentTransactionsSection() {
  const displayCurrency = useDisplayCurrency();
  const investments = useBackendResource(() => fetchInvestments(), []);
  const transactions = useBackendResource(() => fetchInvestmentTransactions(), []);
  const [investmentId, setInvestmentId] = useState("");
  const [type, setType] = useState<InvestmentTransactionType>("buy");
  const [quantity, setQuantity] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayDateInput());
  const [note, setNote] = useState("");
  const submit = async (event: React.SubmitEvent) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!investmentId || !Number.isFinite(numericAmount) || numericAmount < 0) return;
    await createInvestmentTransaction({
      investmentId,
      type,
      quantity: quantity ? Number(quantity) : undefined,
      amount: numericAmount,
      date,
      note: note.trim() || undefined,
    });
    setAmount("");
    setQuantity("");
    setNote("");
  };
  const remove = async (transaction: InvestmentTransaction) => {
    if (transaction.id == null) return;
    const ok = await showConfirm("Delete this investment transaction?", {
      title: "Delete transaction",
      confirmText: "Delete",
    });
    if (ok) await deleteInvestmentTransaction(transaction.id);
  };
  const name = (id: string) =>
    investments?.find((investment) => investment.id === id)?.name ?? `Investment #${id}`;
  const currencyFor = (investmentId: string) =>
    investments?.find((investment) => investment.id === investmentId)?.currency;
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      {" "}
      <div>
        {" "}
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          {" "}
          Investment transactions{" "}
        </h2>{" "}
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {" "}
          Record buys, sells, dividends, and fees alongside your portfolio snapshots.{" "}
        </p>{" "}
      </div>{" "}
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
        {" "}
        <select
          required
          value={investmentId}
          onChange={(event) => setInvestmentId(event.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white"
        >
          {" "}
          <option value="">Investment</option>{" "}
          {investments?.map((investment) => (
            <option key={investment.id} value={investment.id}>
              {" "}
              {investment.name}{" "}
            </option>
          ))}{" "}
        </select>{" "}
        <select
          value={type}
          onChange={(event) => setType(event.target.value as InvestmentTransactionType)}
          className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white"
        >
          {" "}
          <option value="buy">Buy</option> <option value="sell">Sell</option>{" "}
          <option value="dividend">Dividend</option> <option value="fee">Fee</option>{" "}
        </select>{" "}
        <input
          required
          min="0"
          step="0.01"
          type="number"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Amount"
          className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white"
        />{" "}
        <input
          min="0"
          step="0.0001"
          type="number"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          placeholder="Quantity (optional)"
          className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white"
        />{" "}
        <input
          required
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white"
        />{" "}
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Note (optional)"
          className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-white"
        />{" "}
        <button
          type="submit"
          className="flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 font-medium text-white hover:bg-cyan-700 md:col-span-3"
        >
          {" "}
          <Plus className="h-4 w-4" /> Add transaction{" "}
        </button>{" "}
      </form>{" "}
      <div className="overflow-x-auto">
        {" "}
        <table className="w-full min-w-[620px] text-left text-sm text-slate-700 dark:text-slate-300">
          {" "}
          <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-500\">
            {" "}
            <tr>
              {" "}
              <th className="px-3 py-3">Date</th> <th className="px-3 py-3">Investment</th>{" "}
              <th className="px-3 py-3">Type</th> <th className="px-3 py-3">Quantity</th>{" "}
              <th className="px-3 py-3">Amount</th> <th className="px-3 py-3 text-right"> </th>{" "}
            </tr>{" "}
          </thead>{" "}
          <tbody className="divide-y divide-slate-800/60">
            {" "}
            {transactions?.map((transaction) => (
              <tr key={transaction.id}>
                {" "}
                <td className="px-3 py-3"> {formatDateOnly(transaction.date)} </td>{" "}
                <td className="px-3 py-3">{name(transaction.investmentId)}</td>{" "}
                <td className="px-3 py-3 capitalize">{transaction.type}</td>{" "}
                <td className="px-3 py-3">{transaction.quantity ?? "-"}</td>{" "}
                <td className="px-3 py-3">
                  {" "}
                  {formatMoney(
                    convertCurrency(
                      transaction.amount,
                      currencyFor(transaction.investmentId),
                      displayCurrency,
                    ),
                    displayCurrency,
                  )}{" "}
                </td>{" "}
                <td className="px-3 py-3 text-right">
                  {" "}
                  <button
                    type="button"
                    onClick={() => remove(transaction)}
                    className="text-rose-400 hover:text-rose-300"
                    title="Delete transaction"
                  >
                    {" "}
                    <Trash2 className="ml-auto h-4 w-4" />{" "}
                  </button>{" "}
                </td>{" "}
              </tr>
            ))}{" "}
          </tbody>{" "}
        </table>{" "}
      </div>{" "}
    </section>
  );
}
