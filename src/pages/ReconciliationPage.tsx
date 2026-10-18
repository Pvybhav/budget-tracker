import { useMemo, useState } from "react";
import { CheckCircle2, Circle, RotateCcw, Search } from "lucide-react";
import { useBackendResource } from "../services/backendHooks";
import type { Expense } from "../db/db";
import { fetchCards, fetchCategories, fetchExpenses } from "../services/backend.service";
import { updateExpense } from "../services/backendSync";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
import { formatDateOnly } from "../utils/date";
import Tooltip from "../components/Tooltip";
import SortableTableHeader from "../components/SortableTableHeader";
import { useTableSort } from "../components/useTableSort";
export default function ReconciliationPage() {
  const displayCurrency = useDisplayCurrency();
  const expenses = useBackendResource(() => fetchExpenses(), []);
  const cards = useBackendResource(() => fetchCards(), []);
  const categories = useBackendResource(() => fetchCategories(), []);
  const [accountId, setAccountId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [status, setStatus] = useState<"all" | "unverified" | "verified">("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { sortKey, direction, toggleSort, sortRows } = useTableSort<Expense>("date", "desc");
  const visibleExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...(expenses ?? [])]
      .filter((expense) => {
        const category = categories?.find((item) => item.id === expense.categoryId);
        const account = cards?.find((card) => card.id === expense.cardId);
        const expenseDate = expense.date.slice(0, 10);
        return (
          (accountId === "all" || expense.cardId === accountId) &&
          (categoryId === "all" ||
            (categoryId === "uncategorized"
              ? !expense.categoryId
              : expense.categoryId === categoryId)) &&
          (status === "all" ||
            (status === "verified" ? !!expense.reconciled : !expense.reconciled)) &&
          (!dateFrom || expenseDate >= dateFrom) &&
          (!dateTo || expenseDate <= dateTo) &&
          (!query ||
            [
              expense.details ?? "",
              category?.title ?? "",
              account?.title ?? "",
              expense.amount.toString(),
              formatDateOnly(expense.date),
            ]
              .join(" ")
              .toLowerCase()
              .includes(query))
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [accountId, categories, categoryId, cards, dateFrom, dateTo, expenses, search, status]);
  const tableExpenses = sortRows(visibleExpenses, {
    status: (expense) => (expense.reconciled ? "Verified" : "To verify"),
    date: (expense) => expense.date,
    account: (expense) =>
      cards?.find((card) => card.id === expense.cardId)?.title ?? "No account",
    description: (expense) => expense.details ?? "Uncategorized expense",
    amount: (expense) => convertCurrency(expense.amount, expense.currency, displayCurrency),
  });
  const filtersActive =
    accountId !== "all" ||
    categoryId !== "all" ||
    status !== "all" ||
    search.trim().length > 0 ||
    dateFrom !== "" ||
    dateTo !== "";
  const resetFilters = () => {
    setAccountId("all");
    setCategoryId("all");
    setStatus("all");
    setSearch("");
    setDateFrom("");
    setDateTo("");
  };
  const reconciledTotal = visibleExpenses
    .filter((expense) => expense.reconciled)
    .reduce(
      (sum, expense) => sum + convertCurrency(expense.amount, expense.currency, displayCurrency),
      0,
    );
  const pendingTotal = visibleExpenses
    .filter((expense) => !expense.reconciled)
    .reduce(
      (sum, expense) => sum + convertCurrency(expense.amount, expense.currency, displayCurrency),
      0,
    );
  const accountName = (id: string) =>
    cards?.find((card) => card.id === id)?.title ?? "Unknown account";
  const markAllVerified = async () => {
    await Promise.all(
      visibleExpenses
        .filter((expense) => !expense.reconciled && expense.id != null)
        .map((expense) => updateExpense(expense.id!, { reconciled: true })),
    );
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          Reconciliation
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Mark transactions that you have verified against your statement.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[min(100%,16rem)] flex-1 text-sm text-slate-600 dark:text-slate-400">
            Search
            <span className="relative mt-1 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Description, category, account, amount, or date"
                aria-label="Search reconciliation transactions"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </span>
          </label>
          <label className="text-sm text-slate-600 dark:text-slate-400">
            Account
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white sm:w-44"
            >
              <option value="all">All accounts</option>
              {cards?.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600 dark:text-slate-400">
            Category
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white sm:w-40"
            >
              <option value="all">All categories</option>
              <option value="uncategorized">Uncategorized</option>
              {categories?.filter((category) => category.id).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600 dark:text-slate-400">
            Verification
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as "all" | "unverified" | "verified")
              }
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white sm:w-36"
            >
              <option value="all">All statuses</option>
              <option value="unverified">To verify</option>
              <option value="verified">Verified</option>
            </select>
          </label>
          <label className="text-sm text-slate-600 dark:text-slate-400">
            From
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="text-sm text-slate-600 dark:text-slate-400">
            To
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </label>
          {filtersActive && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset filters
            </button>
          )}
          <button
            type="button"
            onClick={markAllVerified}
            disabled={!visibleExpenses.some((expense) => !expense.reconciled)}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mark visible as verified
          </button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div className="text-sm text-slate-600 dark:text-slate-400">Transactions</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {visibleExpenses.length}
          </div>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="text-sm text-slate-400">Verified spending</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-300">
            {formatMoney(reconciledTotal, displayCurrency)}
          </div>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="text-sm text-slate-400">To verify</div>
          <div className="mt-1 text-2xl font-semibold text-amber-300">
            {formatMoney(pendingTotal, displayCurrency)}
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <table className="w-full min-w-[620px] text-left text-slate-700 dark:text-slate-300">
          <thead className="bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <SortableTableHeader label="Status" sortKey="status" activeKey={sortKey} direction={direction} onSort={toggleSort} className="px-5 py-4 text-slate-900 dark:text-slate-100" />
              <SortableTableHeader label="Date" sortKey="date" activeKey={sortKey} direction={direction} onSort={toggleSort} className="px-5 py-4 text-slate-900 dark:text-slate-100" />
              <SortableTableHeader label="Account" sortKey="account" activeKey={sortKey} direction={direction} onSort={toggleSort} className="px-5 py-4 text-slate-900 dark:text-slate-100" />
              <SortableTableHeader label="Description" sortKey="description" activeKey={sortKey} direction={direction} onSort={toggleSort} className="px-5 py-4 text-slate-900 dark:text-slate-100" />
              <SortableTableHeader label="Amount" sortKey="amount" activeKey={sortKey} direction={direction} onSort={toggleSort} className="px-5 py-4 text-slate-900 dark:text-slate-100" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
            {tableExpenses.map((expense) => (
              <tr key={expense.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                <td className="px-5 py-3">
                  <Tooltip content={expense.reconciled ? "Mark as unverified" : "Mark as verified"}>
                    <button
                      onClick={() =>
                        expense.id != null &&
                        updateExpense(expense.id, { reconciled: !expense.reconciled })
                      }
                      className={expense.reconciled ? "text-emerald-400" : "text-slate-500"}
                    >
                      {expense.reconciled ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </button>
                  </Tooltip>
                </td>
                <td className="px-5 py-3"> {formatDateOnly(expense.date)} </td>
                <td className="px-5 py-3">
                  {expense.cardId ? accountName(expense.cardId) : "No account"}
                </td>
                <td className="px-5 py-3"> {expense.details || "Uncategorized expense"} </td>
                <td className="px-5 py-3 font-medium">
                  {formatMoney(
                    convertCurrency(expense.amount, expense.currency, displayCurrency),
                    displayCurrency,
                  )}
                </td>
              </tr>
            ))}
            {visibleExpenses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                  No transactions match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
