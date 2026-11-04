import { useMemo, useState } from "react";
import type { Income } from "../db/db";
import { useBackendResource } from "../services/backendHooks";
import { fetchIncomes, fetchCards } from "../services/backend.service";
import { deleteIncome } from "../services/backendSync";
import AddIncomeModal from "../components/modals/AddIncomeModal";
import showConfirm from "../components/Confirm";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
import PaginationControls from "../components/PaginationControls";
import SortableTableHeader from "../components/SortableTableHeader";
import { useTableSort } from "../components/useTableSort";
import { formatDateOnly } from "../utils/date";
const CATEGORY_LABELS: Record<string, string> = {
  salary: "Salary",
  freelance: "Freelance",
  business: "Business",
  interest: "Interest",
  dividend: "Dividend",
  refund: "Refund",
  gift: "Gift",
  other: "Other",
};
export default function ManageIncomePage() {
  const displayCurrency = useDisplayCurrency();
  const income = useBackendResource(() => fetchIncomes(), []);
  const cards = useBackendResource(() => fetchCards(), []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [incomeToEdit, setIncomeToEdit] = useState<Income | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [page, setPage] = useState(1);
  const { sortKey, direction, toggleSort, sortRows } = useTableSort<Income>("date", "desc");
  const pageSize = 50;
  const openAddModal = () => {
    setIncomeToEdit(undefined);
    setIsModalOpen(true);
  };
  const openEditModal = (item: Income) => {
    setIncomeToEdit(item);
    setIsModalOpen(true);
  };
  const cardTitleFor = (accountId?: string) =>
    accountId ? (cards?.find((c) => c.id === accountId)?.title ?? `#${accountId}`) : "—";
  const sorted = useMemo(
    () => [...(income ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [income],
  );
  const filteredIncome = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sorted.filter(
      (item) =>
        !query ||
        item.source.toLowerCase().includes(query) ||
        CATEGORY_LABELS[item.category ?? "other"].toLowerCase().includes(query) ||
        (cards?.find((card) => card.id === item.accountId)?.title ?? "")
          .toLowerCase()
          .includes(query) ||
        item.note?.toLowerCase().includes(query),
    );
  }, [sorted, search, cards]);
  const filteredIncomeByCriteria = useMemo(() => {
    const min = minAmount === "" ? undefined : Number(minAmount);
    const max = maxAmount === "" ? undefined : Number(maxAmount);
    return filteredIncome.filter((item) => {
      const itemDate = item.date.slice(0, 10);
      const amount = convertCurrency(item.amount, item.currency, displayCurrency);
      return (
        (categoryFilter === "all" || (item.category ?? "other") === categoryFilter) &&
        (accountFilter === "all" || item.accountId === accountFilter) &&
        (!fromDate || itemDate >= fromDate) &&
        (!toDate || itemDate <= toDate) &&
        (min === undefined || amount >= min) &&
        (max === undefined || amount <= max)
      );
    });
  }, [
    filteredIncome,
    categoryFilter,
    accountFilter,
    fromDate,
    toDate,
    minAmount,
    maxAmount,
    displayCurrency,
  ]);
  const visibleIncome = sortRows(filteredIncomeByCriteria, {
    date: (item) => item.date,
    source: (item) => item.source,
    category: (item) => CATEGORY_LABELS[item.category ?? "other"],
    account: (item) => cardTitleFor(item.accountId),
    amount: (item) => convertCurrency(item.amount, item.currency, displayCurrency),
  }).slice((page - 1) * pageSize, page * pageSize);
  const totalThisMonth = useMemo(() => {
    const now = new Date();
    return sorted
      .filter((i) => {
        const d = new Date(i.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, i) => sum + convertCurrency(i.amount, i.currency, displayCurrency), 0);
  }, [sorted, displayCurrency]);
  const totalFilteredIncome = filteredIncomeByCriteria.reduce(
    (sum, item) => sum + convertCurrency(item.amount, item.currency, displayCurrency),
    0,
  );
  const filtersActive =
    search.trim() !== "" ||
    categoryFilter !== "all" ||
    accountFilter !== "all" ||
    fromDate !== "" ||
    toDate !== "" ||
    minAmount !== "" ||
    maxAmount !== "";
  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setAccountFilter("all");
    setFromDate("");
    setToDate("");
    setMinAmount("");
    setMaxAmount("");
    setPage(1);
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            Manage Income
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Track salary and every other rupee coming in.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Income
        </button>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400 sm:col-span-2 lg:col-span-4">
            Search income
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search source, category, account, or note"
              aria-label="Search income"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Category
            <select
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="all">All categories</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Credited to
            <select
              value={accountFilter}
              onChange={(event) => {
                setAccountFilter(event.target.value);
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="all">All accounts</option>
              {cards?.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            From date
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(event) => {
                setFromDate(event.target.value);
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            To date
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => {
                setToDate(event.target.value);
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Minimum amount
            <input
              type="number"
              min="0"
              value={minAmount}
              onChange={(event) => {
                setMinAmount(event.target.value);
                setPage(1);
              }}
              placeholder="No minimum"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Maximum amount
            <input
              type="number"
              min="0"
              value={maxAmount}
              onChange={(event) => {
                setMaxAmount(event.target.value);
                setPage(1);
              }}
              placeholder="No maximum"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <div className="flex items-end sm:col-span-2 lg:col-span-4">
            <div className="flex w-full items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-400">
                {filteredIncomeByCriteria.length} entries ·{" "}
                {formatMoney(totalFilteredIncome, displayCurrency)} total
              </span>
              {filtersActive && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="font-medium text-emerald-700 hover:text-emerald-600 dark:text-emerald-400"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400">
            This month
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300">
            {formatMoney(totalThisMonth, displayCurrency)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400">
            Matching income
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatMoney(totalFilteredIncome, displayCurrency)}
          </div>
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
                label="Source"
                sortKey="source"
                activeKey={sortKey}
                direction={direction}
                onSort={toggleSort}
                className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100"
              />
              <SortableTableHeader
                label="Category"
                sortKey="category"
                activeKey={sortKey}
                direction={direction}
                onSort={toggleSort}
                className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100"
              />
              <SortableTableHeader
                label="Credited To"
                sortKey="account"
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
              <th className="px-6 py-4 font-medium text-right text-slate-900 dark:text-slate-100">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
            {visibleIncome.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors"
              >
                <td className="px-6 py-4"> {formatDateOnly(item.date)} </td>
                <td className="px-6 py-4">{item.source}</td>
                <td className="px-6 py-4"> {CATEGORY_LABELS[item.category ?? "other"]} </td>
                <td className="px-6 py-4">{cardTitleFor(item.accountId)}</td>
                <td className="px-6 py-4 text-emerald-400">
                  {formatMoney(
                    convertCurrency(item.amount, item.currency, displayCurrency),
                    displayCurrency,
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => openEditModal(item)}
                    className="text-blue-400 hover:text-blue-300 mr-3"
                  >
                    <Pencil className="w-4 h-4 inline" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!item.id) return;
                      const ok = await showConfirm(`Delete income entry "${item.source}"?`, {
                        title: "Delete income",
                        confirmText: "Delete",
                      });
                      if (ok) await deleteIncome(item.id);
                    }}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4 inline" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredIncomeByCriteria.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  {income?.length ? "No income matches these filters." : "No income recorded yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls
        page={page}
        totalItems={filteredIncomeByCriteria.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />
      <AddIncomeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialIncome={incomeToEdit}
      />
    </div>
  );
}
