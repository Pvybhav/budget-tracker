import { useState } from "react";
import { ArrowRightLeft, Plus, Trash2 } from "lucide-react";
import type { Transfer } from "../db/db";
import { useBackendResource } from "../services/backendHooks";
import { fetchCards, fetchTransfers } from "../services/backend.service";
import { deleteTransfer } from "../services/backendSync";
import AddTransferModal from "../components/modals/AddTransferModal";
import showConfirm from "../components/Confirm";
export default function ManageTransfersPage() {
  const cards = useBackendResource(() => fetchCards(), []);
  const transfers = useBackendResource(() => fetchTransfers(), []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const accountName = (id: number) =>
    cards?.find((card) => card.id === id)?.title ?? `Account #${id}`;
  const sortedTransfers = [...(transfers ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const handleDelete = async (transfer: Transfer) => {
    const ok = await showConfirm(
      `Delete this transfer of ₹${transfer.amount.toLocaleString("en-IN")}?`,
      { title: "Delete transfer", confirmText: "Delete" },
    );
    if (ok && transfer.id != null) await deleteTransfer(transfer.id);
  };
  return (
    <div className="space-y-6">
      {" "}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        {" "}
        <div>
          {" "}
          <h1 className="text-3xl font-semibold text-slate-100"> Account Transfers </h1>{" "}
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
      <div className="overflow-hidden overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
        {" "}
        <table className="w-full min-w-[640px] text-left text-slate-300">
          {" "}
          <thead className="bg-slate-800/50">
            {" "}
            <tr>
              {" "}
              <th className="px-6 py-4 font-medium">Date</th>{" "}
              <th className="px-6 py-4 font-medium">From</th>{" "}
              <th className="px-6 py-4 font-medium"></th>{" "}
              <th className="px-6 py-4 font-medium">To</th>{" "}
              <th className="px-6 py-4 font-medium">Amount</th>{" "}
              <th className="px-6 py-4 text-right font-medium">Actions</th>{" "}
            </tr>{" "}
          </thead>{" "}
          <tbody className="divide-y divide-slate-800/50">
            {" "}
            {sortedTransfers.map((transfer) => (
              <tr key={transfer.id} className="hover:bg-slate-800/20">
                {" "}
                <td className="px-6 py-4"> {new Date(transfer.date).toLocaleDateString()} </td>{" "}
                <td className="px-6 py-4"> {accountName(transfer.fromAccountId)} </td>{" "}
                <td className="px-6 py-4 text-emerald-400">
                  {" "}
                  <ArrowRightLeft className="h-4 w-4" />{" "}
                </td>{" "}
                <td className="px-6 py-4"> {accountName(transfer.toAccountId)} </td>{" "}
                <td className="px-6 py-4 font-medium text-emerald-400">
                  {" "}
                  ₹{" "}
                  {transfer.amount.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
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
            {sortedTransfers.length === 0 && (
              <tr>
                {" "}
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  {" "}
                  No transfers recorded.{" "}
                </td>{" "}
              </tr>
            )}{" "}
          </tbody>{" "}
        </table>{" "}
      </div>{" "}
      <AddTransferModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        cards={cards ?? []}
      />{" "}
    </div>
  );
}
