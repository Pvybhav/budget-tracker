import { useMemo, useState } from "react";
import type { Payment } from "../db/db";
import { useBackendResource } from "../services/backendHooks";
import { deletePayment } from "../services/backendSync";
import showConfirm from "../components/Confirm";
import AddPaymentModal from "../components/modals/AddPaymentModal";
import { fetchCards, fetchPayments } from "../services/backend.service";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
import PaginationControls from "../components/PaginationControls";
import { dateOnly, formatDateOnly } from "../utils/date";
import Tooltip from "../components/Tooltip";
import SortableTableHeader from "../components/SortableTableHeader";
import { useTableSort } from "../components/useTableSort";
import { CalendarDays, Filter, Search, X } from "lucide-react";

export default function ManagePaymentsPage() {
  const displayCurrency = useDisplayCurrency();
  const payments = useBackendResource(() => fetchPayments(), []);
  const cards = useBackendResource(() => fetchCards(), []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paymentToEdit, setPaymentToEdit] = useState<Payment | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [cardFilter, setCardFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const { sortKey, direction, toggleSort, sortRows } = useTableSort<Payment>("date", "desc");
  const pageSize = 50;
  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (payments ?? []).filter((payment) => {
      const cardTitle = cards?.find((card) => card.id === payment.cardId)?.title ?? "";
      const paymentDate = dateOnly(payment.date);
      const amount = convertCurrency(payment.amount, payment.currency, displayCurrency);
      const min = minAmount === "" ? undefined : Number(minAmount);
      const max = maxAmount === "" ? undefined : Number(maxAmount);
      return (
        (!query ||
          payment.cardId.toLowerCase().includes(query) ||
          cardTitle.toLowerCase().includes(query) ||
          payment.date.toLowerCase().includes(query) ||
          payment.note?.toLowerCase().includes(query)) &&
        (cardFilter === "all" || payment.cardId === cardFilter) &&
        (!fromDate || paymentDate >= fromDate) &&
        (!toDate || paymentDate <= toDate) &&
        (min === undefined || amount >= min) &&
        (max === undefined || amount <= max)
      );
    });
  }, [
    payments,
    cards,
    search,
    cardFilter,
    fromDate,
    toDate,
    minAmount,
    maxAmount,
    displayCurrency,
  ]);
  const sortedPayments = sortRows(filteredPayments, {
    date: (payment) => payment.date,
    card: (payment) => cards?.find((card) => card.id === payment.cardId)?.title ?? "",
    amount: (payment) => convertCurrency(payment.amount, payment.currency, displayCurrency),
    notes: (payment) => payment.note ?? "",
  });
  const visiblePayments = sortedPayments.slice((page - 1) * pageSize, page * pageSize);
  const hasFilters = search || cardFilter !== "all" || fromDate || toDate || minAmount || maxAmount;
  const totalFilteredAmount = filteredPayments.reduce(
    (sum, payment) => sum + convertCurrency(payment.amount, payment.currency, displayCurrency),
    0,
  );
  const clearFilters = () => {
    setSearch("");
    setCardFilter("all");
    setFromDate("");
    setToDate("");
    setMinAmount("");
    setMaxAmount("");
    setPage(1);
  };

  const openAddModal = () => {
    setPaymentToEdit(undefined);
    setIsModalOpen(true);
  };

  const openEditModal = (payment: Payment) => {
    setPaymentToEdit(payment);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          Manage Payments
        </h1>
        <button
          onClick={openAddModal}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Add Payment
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search accounts, dates, or notes"
              aria-label="Search payments"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <select
            value={cardFilter}
            onChange={(event) => {
              setCardFilter(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by account"
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="all">All accounts</option>
            {cards?.map((card) => (
              <option key={card.id} value={card.id}>
                {card.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
              showFilters || hasFilters
                ? "border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300"
                : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </div>
        {showFilters && (
          <div className="mt-3 grid gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
              From date
              <span className="relative mt-1 block">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(event) => {
                    setFromDate(event.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </span>
            </label>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
              To date
              <span className="relative mt-1 block">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(event) => {
                    setToDate(event.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </span>
            </label>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Minimum amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={minAmount}
                onChange={(event) => {
                  setMinAmount(event.target.value);
                  setPage(1);
                }}
                placeholder="0.00"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Maximum amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={maxAmount}
                onChange={(event) => {
                  setMaxAmount(event.target.value);
                  setPage(1);
                }}
                placeholder="No limit"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span>
            {filteredPayments.length} payment{filteredPayments.length === 1 ? "" : "s"} ·{" "}
            {formatMoney(totalFilteredAmount, displayCurrency)} total
          </span>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 font-medium text-purple-600 hover:text-purple-500 dark:text-purple-400"
            >
              <X className="h-3.5 w-3.5" /> Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-max">
          <thead className="bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <SortableTableHeader
                label="Date"
                sortKey="date"
                activeKey={sortKey}
                direction={direction}
                onSort={toggleSort}
                className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100"
              />
              <SortableTableHeader
                label="Card"
                sortKey="card"
                activeKey={sortKey}
                direction={direction}
                onSort={toggleSort}
                className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100"
              />
              <SortableTableHeader
                label="Amount"
                sortKey="amount"
                activeKey={sortKey}
                direction={direction}
                onSort={toggleSort}
                className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100"
              />
              <SortableTableHeader
                label="Notes"
                sortKey="notes"
                activeKey={sortKey}
                direction={direction}
                onSort={toggleSort}
                className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100"
              />
              <th className="px-6 py-4 font-medium text-right text-slate-900 dark:text-slate-100">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
            {visiblePayments.map((payment) => (
              <tr
                key={payment.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors"
              >
                <td className="px-6 py-4">{formatDateOnly(payment.date)}</td>
                <td className="px-6 py-4">
                  {cards?.find((card) => card.id === payment.cardId)?.title ?? "Unknown card"}
                </td>
                <td className="px-6 py-4">
                  {formatMoney(
                    convertCurrency(payment.amount, payment.currency, displayCurrency),
                    displayCurrency,
                  )}
                </td>
                <Tooltip content={payment.note ?? ""}>
                  <td className="px-6 py-4 max-w-xs truncate">{payment.note || "-"}</td>
                </Tooltip>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => openEditModal(payment)}
                    className="text-blue-400 hover:text-blue-300 mr-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await showConfirm(
                        `Delete this payment of ${formatMoney(convertCurrency(payment.amount, payment.currency, displayCurrency), displayCurrency)}?`,
                        { title: "Delete payment", confirmText: "Delete" },
                      );
                      if (ok) await deletePayment(payment.id!);
                    }}
                    className="text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {filteredPayments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  {payments?.length ? "No payments match your search." : "No payments found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls
        page={page}
        totalItems={filteredPayments.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />

      <AddPaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialPayment={paymentToEdit}
      />
    </div>
  );
}
