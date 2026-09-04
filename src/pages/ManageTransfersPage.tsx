import { useState } from "react";
import { ArrowRightLeft, Plus, Trash2 } from "lucide-react";
import type { Transfer } from "../db/db";
import { useBackendResource } from "../services/backendHooks";
import { fetchBeneficiaries, fetchCards, fetchTransfers } from "../services/backend.service";
import { deleteBeneficiary, deleteTransfer } from "../services/backendSync";
import type { Beneficiary } from "../db/db";
import AddTransferModal from "../components/modals/AddTransferModal";
import showConfirm from "../components/Confirm";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
import PaginationControls from "../components/PaginationControls";
export default function ManageTransfersPage() {
  const displayCurrency = useDisplayCurrency();
  const cards = useBackendResource(() => fetchCards(), []);
  const transfers = useBackendResource(() => fetchTransfers(), []);
  const beneficiaries = useBackendResource(() => fetchBeneficiaries(), []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const accountName = (id: string) =>
    cards?.find((card) => card.id === id)?.title ?? `Account #${id}`;
  const sortedTransfers = [...(transfers ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const destinationName = (transfer: Transfer) =>
    transfer.destinationType === "external"
      ? (transfer.externalName ?? "External recipient")
      : accountName(transfer.toAccountId ?? "");
  const filteredTransfers = sortedTransfers.filter((transfer) => {
    const query = search.trim().toLowerCase();
    return (
      !query ||
      accountName(transfer.fromAccountId).toLowerCase().includes(query) ||
      destinationName(transfer).toLowerCase().includes(query) ||
      transfer.externalName?.toLowerCase().includes(query) ||
      transfer.date.toLowerCase().includes(query) ||
      transfer.note?.toLowerCase().includes(query)
    );
  });
  const visibleTransfers = filteredTransfers.slice((page - 1) * pageSize, page * pageSize);
  const handleDelete = async (transfer: Transfer) => {
    const ok = await showConfirm(
      `Delete this transfer of ${formatMoney(convertCurrency(transfer.amount, transfer.currency, displayCurrency), displayCurrency)}?`,
      { title: "Delete transfer", confirmText: "Delete" },
    );
    if (ok && transfer.id != null) await deleteTransfer(transfer.id);
  };
  const handleDeleteBeneficiary = async (beneficiary: Beneficiary) => {
    if (!beneficiary.id) return;
    const ok = await showConfirm(`Delete saved beneficiary "${beneficiary.name}"?`, {
      title: "Delete beneficiary",
      confirmText: "Delete",
    });
    if (ok) await deleteBeneficiary(beneficiary.id);
  };
  return (
    <div className="space-y-6">
      {" "}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        {" "}
        <div>
          {" "}
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            {" "}
            Account Transfers{" "}
          </h1>{" "}
          <p className="mt-1 text-sm text-slate-400">
            {" "}
            Move money between accounts without affecting your spending totals.{" "}
          </p>{" "}
        </div>{" "}
        <button
          onClick={() => setIsModalOpen(true)}
          disabled={!cards || cards.length < 2}
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {" "}
          <Plus className="h-4 w-4" /> Add Transfer{" "}
        </button>{" "}
      </div>{" "}
      <input
        type="search"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        placeholder="Search accounts, recipients, or dates"
        aria-label="Search transfers"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />{" "}
      <div className="overflow-hidden overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {" "}
        <table className="w-full min-w-[640px] text-left text-slate-700 dark:text-slate-300">
          {" "}
          <thead className="bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
            {" "}
            <tr>
              {" "}
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                Date
              </th>{" "}
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">From</th>{" "}
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100"></th>{" "}
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">To</th>{" "}
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">Amount</th>{" "}
              <th className="px-6 py-4 text-right font-medium text-slate-900 dark:text-slate-100">
                Actions
              </th>{" "}
            </tr>{" "}
          </thead>{" "}
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
            {" "}
            {visibleTransfers.map((transfer) => (
              <tr key={transfer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                {" "}
                <td className="px-6 py-4"> {new Date(transfer.date).toLocaleDateString()} </td>{" "}
                <td className="px-6 py-4"> {accountName(transfer.fromAccountId)} </td>{" "}
                <td className="px-6 py-4 text-emerald-400">
                  {" "}
                  <ArrowRightLeft className="h-4 w-4" />{" "}
                </td>{" "}
                <td className="px-6 py-4"> {destinationName(transfer)} </td>{" "}
                <td className="px-6 py-4 font-medium text-emerald-400">
                  {" "}
                  {formatMoney(
                    convertCurrency(transfer.amount, transfer.currency, displayCurrency),
                    displayCurrency,
                  )}{" "}
                </td>{" "}
                <td className="px-6 py-4 text-right">
                  {" "}
                  <button
                    onClick={() => handleDelete(transfer)}
                    className="text-red-400 hover:text-red-300"
                    title="Delete transfer"
                  >
                    {" "}
                    <Trash2 className="ml-auto h-4 w-4" />{" "}
                  </button>{" "}
                </td>{" "}
              </tr>
            ))}{" "}
            {filteredTransfers.length === 0 && (
              <tr>
                {" "}
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  {" "}
                  {transfers?.length
                    ? "No transfers match your search."
                    : "No transfers recorded."}{" "}
                </td>{" "}
              </tr>
            )}{" "}
          </tbody>{" "}
        </table>{" "}
      </div>{" "}
      <PaginationControls
        page={page}
        totalItems={filteredTransfers.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />{" "}
      {beneficiaries && beneficiaries.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">
              Saved beneficiaries
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Reuse these recipients when creating an external transfer.
            </p>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {beneficiaries.map((beneficiary) => (
              <div
                key={beneficiary.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {beneficiary.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {[beneficiary.bankName, beneficiary.accountNumber, beneficiary.upiId]
                      .filter(Boolean)
                      .join(" · ") || "No bank details saved"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteBeneficiary(beneficiary)}
                  className="text-sm text-rose-600 hover:text-rose-700 dark:text-rose-400"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
      <AddTransferModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        cards={cards ?? []}
      />{" "}
    </div>
  );
}
