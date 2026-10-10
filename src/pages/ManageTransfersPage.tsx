import { useState } from "react";
import { ArrowRightLeft, Landmark, Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import type { Card, Transfer } from "../db/db";
import { useBackendResource } from "../services/backendHooks";
import { fetchBeneficiaries, fetchCards, fetchTransfers } from "../services/backend.service";
import { deleteBeneficiary, deleteTransfer } from "../services/backendSync";
import type { Beneficiary } from "../db/db";
import AddTransferModal from "../components/modals/AddTransferModal";
import showConfirm from "../components/Confirm";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
import PaginationControls from "../components/PaginationControls";
import { formatDateOnly } from "../utils/date";
import Tooltip from "../components/Tooltip";
import hdfcLogo from "../assets/banks/hdfc.png";
import iciciLogo from "../assets/banks/icici.png";
import sbiLogo from "../assets/banks/sbi.svg";

function BankMark({ card, bankName }: { card?: Card; bankName?: string }) {
  const name = bankName ?? card?.bankName ?? card?.title ?? "";
  const normalized = name.toLowerCase();
  const logo = normalized.includes("hdfc")
    ? hdfcLogo
    : normalized.includes("icici")
      ? iciciLogo
      : normalized.includes("sbi") || normalized.includes("state bank")
        ? sbiLogo
        : undefined;

  return logo ? (
    <img src={logo} alt="" className="h-8 w-8 shrink-0 rounded-md object-contain" />
  ) : (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
      <Landmark className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

export default function ManageTransfersPage() {
  const displayCurrency = useDisplayCurrency();
  const cards = useBackendResource(() => fetchCards(), []);
  const transfers = useBackendResource(() => fetchTransfers(), []);
  const beneficiaries = useBackendResource(() => fetchBeneficiaries(), []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<Transfer | undefined>();
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "month">("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const accountName = (id: string) =>
    cards?.find((card) => card.id === id)?.title ?? "Unknown account";
  const sortedTransfers = [...(transfers ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const destinationName = (transfer: Transfer) =>
    transfer.destinationType === "external"
      ? (transfer.externalName ?? "External recipient")
      : accountName(transfer.toAccountId ?? "");
  const filteredTransfers = sortedTransfers.filter((transfer) => {
    const query = search.trim().toLowerCase();
    const transferDate = new Date(transfer.date);
    const now = new Date();
    const matchesDate =
      dateFilter === "all" ||
      (transferDate.getFullYear() === now.getFullYear() &&
        transferDate.getMonth() === now.getMonth());
    return (
      matchesDate &&
      (!query ||
        accountName(transfer.fromAccountId).toLowerCase().includes(query) ||
        destinationName(transfer).toLowerCase().includes(query) ||
        transfer.externalName?.toLowerCase().includes(query) ||
        transfer.date.toLowerCase().includes(query) ||
        transfer.note?.toLowerCase().includes(query))
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
  const resetFilters = () => {
    setSearch("");
    setDateFilter("all");
    setPage(1);
  };
  const filtersActive = search.trim().length > 0 || dateFilter !== "all";
  const filteredTotal = filteredTransfers.reduce(
    (sum, transfer) =>
      sum + convertCurrency(transfer.amount, transfer.currency, displayCurrency),
    0,
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Account Transfers
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Track money moving between your accounts and to external recipients.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingTransfer(undefined);
            setIsModalOpen(true);
          }}
          disabled={!cards || cards.length < 2}
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add Transfer
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <label className="relative min-w-[min(100%,18rem)] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search accounts, recipients, or notes"
            aria-label="Search transfers"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
        <button
          type="button"
          aria-pressed={dateFilter === "month"}
          onClick={() => {
            setDateFilter((current) => (current === "month" ? "all" : "month"));
            setPage(1);
          }}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            dateFilter === "month"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          This month
        </button>
        {filtersActive && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset filters
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400">Transfers shown</p>
          <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {filteredTransfers.length}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="text-xs text-emerald-800 dark:text-emerald-300">Total moved</p>
          <p className="mt-1 text-lg font-semibold text-emerald-800 dark:text-emerald-200">
            {formatMoney(filteredTotal, displayCurrency)}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[640px] text-left text-sm text-slate-700 dark:text-slate-300">
          <thead className="border-b border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50">
            <tr>
              <th className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">Date</th>
              <th className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">From</th>
              <th className="w-8 px-1 py-3"></th>
              <th className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">To</th>
              <th className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">Amount</th>
              <th className="px-3 py-3 text-right font-medium text-slate-900 dark:text-slate-100">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
            {visibleTransfers.map((transfer) => (
              <tr key={transfer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                <td className="whitespace-nowrap px-3 py-3">{formatDateOnly(transfer.date)}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <BankMark card={cards?.find((card) => card.id === transfer.fromAccountId)} />
                    <span>{accountName(transfer.fromAccountId)}</span>
                  </div>
                </td>
                <td className="px-1 py-3 text-emerald-600 dark:text-emerald-400">
                  <ArrowRightLeft className="h-4 w-4" />
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <BankMark
                      bankName={transfer.externalBankName}
                      card={
                        transfer.destinationType === "external"
                          ? undefined
                          : cards?.find((card) => card.id === transfer.toAccountId)
                      }
                    />
                    <span>
                      {destinationName(transfer)}
                      {transfer.externalBankName && (
                        <span className="block text-xs text-slate-500">
                          {transfer.externalBankName}
                        </span>
                      )}
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-3 font-medium text-emerald-600 dark:text-emerald-400">
                  {formatMoney(
                    convertCurrency(transfer.amount, transfer.currency, displayCurrency),
                    displayCurrency,
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right">
                  <Tooltip content="Edit transfer">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTransfer(transfer);
                        setIsModalOpen(true);
                      }}
                      className="mr-2 inline-flex rounded p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                      aria-label="Edit transfer"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Delete transfer">
                    <button
                      type="button"
                      onClick={() => handleDelete(transfer)}
                      className="text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                    >
                      <Trash2 className="ml-auto h-4 w-4" />
                    </button>
                  </Tooltip>
                </td>
              </tr>
            ))}
            {filteredTransfers.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-10 text-center text-slate-600 dark:text-slate-500"
                >
                  {transfers?.length ? "No transfers match your search." : "No transfers recorded."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls
        page={page}
        totalItems={filteredTransfers.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />
      {beneficiaries && beneficiaries.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
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
                  <div className="text-xs text-slate-500 dark:text-slate-400">
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
        onClose={() => {
          setIsModalOpen(false);
          setEditingTransfer(undefined);
        }}
        cards={cards ?? []}
        initialTransfer={editingTransfer}
      />
    </div>
  );
}
