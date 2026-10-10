import { Fragment, useEffect, useMemo, useState } from "react";
import { useBackendResource } from "../services/backendHooks";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { type Expense, type Category } from "../db/db";
import { calcMonthlyEmi, getEmiSchedule } from "../services/card.service";
import AddExpenseModal from "../components/modals/AddExpenseModal";
import CategoryExpensesModal from "../components/modals/CategoryExpensesModal";
import { fetchCards, fetchExpenses, fetchCategories } from "../services/backend.service";
import showConfirm from "../components/Confirm";
import { deleteExpense, updateExpense } from "../services/backendSync";
import { getNextRecurringExpenseDue, syncRecurringExpenses } from "../services/recurring.service";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
import { dateOnly, formatDateInput, formatDateOnly } from "../utils/date";
import { getCategoryAccent } from "../utils/categoryTheme";
import Tooltip from "../components/Tooltip";
import { getCategoryIcon } from "../utils/categoryIcons";
import { Check, CheckCircle2, Clock3, Eye, Pencil, Trash2 } from "lucide-react";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

function getEmiProgress(expense: Expense) {
  const months = Math.max(1, expense.emiMonths ?? 1);
  const start = new Date(`${(expense.emiStartDate ?? expense.date).slice(0, 10)}T00:00:00`);
  start.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setMonth(end.getMonth() + months - 1);
  end.setHours(0, 0, 0, 0);

  const monthlyEmi =
    calcMonthlyEmi(expense.amount, expense.emiInterestRate ?? 0, months) +
    (expense.emiProcessingFee ?? 0) / months +
    (expense.emiGst ?? 0) / months;

  const paidInstallments = Math.min(
    months,
    Math.max(
      0,
      (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth()) + 1,
    ),
  );
  const pendingInstallments = Math.max(0, months - paidInstallments);

  return {
    end,
    monthlyEmi,
    paidInstallments,
    pendingInstallments,
    paidAmount: monthlyEmi * paidInstallments,
    pendingAmount: monthlyEmi * pendingInstallments,
  };
}

export default function ManageExpensesPage({ mode }: { mode?: "monthly" | "yearly" | "emi" }) {
  const displayCurrency = useDisplayCurrency();
  const expenses = useBackendResource(() => fetchExpenses(), []);
  const categories = useBackendResource(() => fetchCategories(), []);
  const cards = useBackendResource(() => fetchCards(), []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | undefined>(undefined);
  const [selectedEmiExpense, setSelectedEmiExpense] = useState<Expense | null>(null);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "amount-desc" | "amount-asc">(
    "date-desc",
  );
  const [showEmiOnly, setShowEmiOnly] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [selectedCardId, setSelectedCardId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "pending" | "paid">("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    setPage(1);
  }, [
    mode,
    selectedYear,
    selectedMonth,
    searchQuery,
    sortBy,
    showEmiOnly,
    selectedCategoryId,
    selectedCardId,
    selectedStatus,
  ]);
  useEffect(() => {
    setSelectedCategoryId("all");
    setSelectedCardId("all");
    setSelectedStatus("all");
    setShowEmiOnly(false);
  }, [mode]);

  const [categoryModal, setCategoryModal] = useState<{
    open: boolean;
    category: Category | null;
    year?: number;
    month?: number;
  }>({
    open: false,
    category: null,
  });

  const periodFilteredExpenses = expenses?.filter((expense) => {
    if (!mode) return true;
    if (mode === "emi") {
      return !!expense.isEmi;
    }
    const expenseDate = new Date(expense.date);
    if (mode === "monthly") {
      return (
        expenseDate.getFullYear() === selectedYear && expenseDate.getMonth() + 1 === selectedMonth
      );
    }
    if (mode === "yearly") {
      return expenseDate.getFullYear() === selectedYear;
    }
    return true;
  });
  const usedCategoryIds = new Set(
    (periodFilteredExpenses ?? [])
      .map((expense) => expense.categoryId)
      .filter((categoryId): categoryId is string => Boolean(categoryId)),
  );
  const usedCardIds = new Set(
    (periodFilteredExpenses ?? [])
      .map((expense) => expense.cardId)
      .filter((cardId): cardId is string => Boolean(cardId)),
  );

  const filteredExpenses = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const result = (periodFilteredExpenses || []).filter((expense) => {
      const category = categories?.find((c) => c.id === expense.categoryId);
      const haystack = [
        expense.details ?? "",
        category?.title ?? "",
        expense.cardId?.toString() ?? "",
        expense.amount?.toString() ?? "",
        formatDateOnly(expense.date),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = normalizedQuery.length === 0 || haystack.includes(normalizedQuery);
      const matchesCategory =
        selectedCategoryId === "all" || expense.categoryId?.toString() === selectedCategoryId;
      const matchesCard = selectedCardId === "all" || expense.cardId === selectedCardId;
      const matchesStatus =
        selectedStatus === "all" || (expense.status ?? "pending") === selectedStatus;
      const matchesEmi = mode === "emi" || !showEmiOnly || !!expense.isEmi;

      return matchesSearch && matchesCategory && matchesCard && matchesStatus && matchesEmi;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case "amount-asc":
          return a.amount - b.amount;
        case "amount-desc":
          return b.amount - a.amount;
        case "date-asc":
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case "date-desc":
        default:
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });

    return result;
  }, [
    categories,
    periodFilteredExpenses,
    searchQuery,
    selectedCategoryId,
    selectedCardId,
    showEmiOnly,
    selectedStatus,
    sortBy,
    mode,
  ]);
  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / pageSize));
  const visibleExpenses = filteredExpenses.slice((page - 1) * pageSize, page * pageSize);
  const groupExpensesByDate = sortBy === "date-desc" || sortBy === "date-asc";
  const visibleExpenseGroups = groupExpensesByDate
    ? Array.from(
        visibleExpenses.reduce((groups, expense) => {
          const date = dateOnly(expense.date);
          const group = groups.get(date) ?? [];
          group.push(expense);
          groups.set(date, group);
          return groups;
        }, new Map<string, Expense[]>()),
        ([date, groupedExpenses]) => ({
          dateKey: date,
          date: formatDateOnly(date),
          expenses: groupedExpenses,
        }),
      )
    : visibleExpenses.map((expense, index) => ({
        dateKey: `${dateOnly(expense.date)}-${expense.id ?? index}`,
        date: formatDateOnly(expense.date),
        expenses: [expense],
      }));

  const totalAmount =
    filteredExpenses?.reduce(
      (sum, expense) => sum + convertCurrency(expense.amount, expense.currency, displayCurrency),
      0,
    ) || 0;

  const expenseCount = filteredExpenses?.length || 0;
  const emiCount = filteredExpenses?.filter((expense) => expense.isEmi).length || 0;
  const biggestExpense = filteredExpenses?.reduce<Expense | undefined>((max, expense) => {
    if (!max || expense.amount > max.amount) return expense;
    return max;
  }, undefined);
  const emiSummary = useMemo(
    () =>
      (filteredExpenses ?? []).reduce(
        (summary, expense) => {
          const progress = getEmiProgress(expense);
          return {
            plans: summary.plans + 1,
            monthly:
              summary.monthly +
              convertCurrency(progress.monthlyEmi, expense.currency, displayCurrency),
            paid:
              summary.paid +
              convertCurrency(progress.paidAmount, expense.currency, displayCurrency),
            pending:
              summary.pending +
              convertCurrency(progress.pendingAmount, expense.currency, displayCurrency),
          };
        },
        { plans: 0, monthly: 0, paid: 0, pending: 0 },
      ),
    [filteredExpenses, displayCurrency],
  );

  const monthlyBreakdown =
    mode === "yearly"
      ? Array.from({ length: 12 }, (_, i) => {
          const month = i + 1;
          const monthExpenses = filteredExpenses?.filter(
            (expense) => new Date(expense.date).getMonth() + 1 === month,
          );
          return {
            name: new Date(0, i).toLocaleString("default", { month: "short" }),
            amount:
              monthExpenses?.reduce(
                (sum, e) => sum + convertCurrency(e.amount, e.currency, displayCurrency),
                0,
              ) || 0,
          };
        })
      : [];

  const getCategoryById = (id?: string): Category | undefined => {
    if (!id) return undefined;
    return categories?.find((c) => c.id === id);
  };

  const handleDelete = async (expense: Expense) => {
    const ok = await showConfirm("Are you sure you want to delete this expense?", {
      title: "Delete expense",
    });
    if (ok) {
      await deleteExpense(expense.id!);
    }
  };

  const handleMarkPaid = async (expense: Expense) => {
    if (expense.id) await updateExpense(expense.id, { status: "paid" });
  };

  const handleSkipNext = async (expense: Expense) => {
    if (expense.id) {
      await updateExpense(expense.id, { skipNextDue: !expense.skipNextDue });
      if (!expense.skipNextDue) await syncRecurringExpenses();
    }
  };

  const openAddModal = () => {
    setExpenseToEdit(undefined);
    setIsModalOpen(true);
  };

  const openEditModal = (expense: Expense) => {
    setExpenseToEdit(expense);
    setIsModalOpen(true);
  };

  const openCategoryModal = (category: Category) => {
    setCategoryModal({
      open: true,
      category,
      year: selectedYear,
      month: mode === "yearly" ? undefined : selectedMonth,
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategoryId("all");
    setSelectedCardId("all");
    setSelectedStatus("all");
    setShowEmiOnly(false);
    setPage(1);
  };

  const resetFilters = () => {
    clearFilters();
    setSortBy("date-desc");
    setSelectedYear(new Date().getFullYear());
    setSelectedMonth(new Date().getMonth() + 1);
  };
  const filtersModified =
    searchQuery.trim().length > 0 ||
    selectedCategoryId !== "all" ||
    selectedCardId !== "all" ||
    selectedStatus !== "all" ||
    showEmiOnly ||
    sortBy !== "date-desc" ||
    selectedYear !== new Date().getFullYear() ||
    (mode === "monthly" && selectedMonth !== new Date().getMonth() + 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          {mode === "monthly"
            ? "Monthly Manage Expenses"
            : mode === "yearly"
              ? "Yearly Manage Expenses"
              : mode === "emi"
                ? "Manage EMI Payments"
                : "Manage Expenses"}
        </h1>
        <button
          onClick={openAddModal}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shrink-0 whitespace-nowrap self-start sm:self-auto"
        >
          Add Expense
        </button>
      </div>

      <div className="flex flex-wrap gap-4">
        {mode !== "emi" && (
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(parseInt(e.target.value));
              setPage(1);
            }}
            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
          >
            {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
        {mode === "monthly" && (
          <select
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(parseInt(e.target.value));
              setPage(1);
            }}
            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-emerald-500"
          >
            {[...Array(12)].map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(0, i).toLocaleString("default", { month: "long" })}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.6fr_1fr_1fr_1fr] xl:gap-3">
        <label className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-400">
          <span>Search expenses</span>
          <input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by description, category, amount..."
            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-emerald-500 dark:focus:border-emerald-500"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-400">
          <span>Category</span>
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-emerald-500 dark:focus:border-emerald-500"
          >
            <option value="all">All categories</option>
            {categories?.filter((category) => usedCategoryIds.has(category.id ?? "")).map((category) => (
              <option key={category.id} value={category.id?.toString()}>
                {category.title}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-400">
          <span>Sort by</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-emerald-500 dark:focus:border-emerald-500"
          >
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="amount-desc">Highest amount</option>
            <option value="amount-asc">Lowest amount</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-400">
          <span>Card</span>
          <select
            value={selectedCardId}
            onChange={(e) => {
              setSelectedCardId(e.target.value);
              setPage(1);
            }}
            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-emerald-500 dark:focus:border-emerald-500"
          >
            <option value="all">All cards</option>
            {cards?.filter((card) => usedCardIds.has(card.id ?? "")).map((card) => (
              <option key={card.id} value={card.id?.toString()}>
                {card.title}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-400">
          <span>Quick filters</span>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { label: "All", status: "all", emi: false },
                { label: "Pending", status: "pending", emi: false },
                { label: "Paid", status: "paid", emi: false },
                { label: "EMI", status: "all", emi: true },
              ] as const
            ).map((filter) => {
              const active =
                selectedStatus === filter.status && showEmiOnly === filter.emi;
              return (
                <button
                  key={filter.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setSelectedStatus(filter.status);
                    setShowEmiOnly(filter.emi);
                    setPage(1);
                  }}
                  className={cn(
                    "rounded-lg border px-2.5 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
                  )}
                >
                  {filter.label}
                </button>
              );
            })}
            {filtersModified && (
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      </div>

      {mode === "emi" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-4">
            <div className="text-sm text-slate-600 dark:text-slate-400">EMI plans</div>
            <div className="mt-1 text-2xl font-semibold text-cyan-700 dark:text-cyan-200">
              {emiSummary.plans}
            </div>
          </div>
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
            <div className="text-sm text-slate-600 dark:text-slate-400">Monthly commitment</div>
            <div className="mt-1 text-2xl font-semibold text-amber-700 dark:text-amber-200">
              {formatMoney(emiSummary.monthly, displayCurrency)}
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
            <div className="text-sm text-slate-600 dark:text-slate-400">Paid to date</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-700 dark:text-emerald-200">
              {formatMoney(emiSummary.paid, displayCurrency)}
            </div>
          </div>
          <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4">
            <div className="text-sm text-slate-600 dark:text-slate-400">Pending balance</div>
            <div className="mt-1 text-2xl font-semibold text-rose-700 dark:text-rose-200">
              {formatMoney(emiSummary.pending, displayCurrency)}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
            <p className="text-slate-600 dark:text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">
              {mode === "monthly"
                ? "Month Total"
                : mode === "yearly"
                  ? "Year Total"
                  : "Visible Total"}
            </p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatMoney(totalAmount, displayCurrency)}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
            <p className="text-slate-600 dark:text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">
              Transactions
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{expenseCount}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
            <p className="text-slate-600 dark:text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">
              EMI Count
            </p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{emiCount}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
            <p className="text-slate-600 dark:text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">
              Largest Spend
            </p>
            <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">
              {formatMoney(
                convertCurrency(
                  biggestExpense?.amount ?? 0,
                  biggestExpense?.currency,
                  displayCurrency,
                ),
                displayCurrency,
              )}
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-500 truncate">
              {biggestExpense?.details || "No expense yet"}
            </p>
          </div>
        </div>
      )}

      {mode && mode !== "emi" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
            <p className="text-slate-600 dark:text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">
              {mode === "monthly" ? "Month Total" : "Year Total"}
            </p>
            <p className="text-2xl font-bold text-emerald-400">
              {formatMoney(totalAmount, displayCurrency)}
            </p>
          </div>

          {mode === "yearly" && (
            <div className="md:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl overflow-x-auto">
              <p className="text-slate-600 dark:text-slate-400 text-sm font-medium uppercase tracking-wider mb-4">
                Monthly Breakdown
              </p>
              <div className="flex gap-6 min-w-max pb-2">
                {monthlyBreakdown.map((mb) => (
                  <div key={mb.name} className="flex flex-col items-center">
                    <div className="text-xs text-slate-500 mb-1">{mb.name}</div>
                    <div
                      className={cn(
                        "text-sm font-semibold",
                        mb.amount > 0
                          ? "text-slate-900 dark:text-slate-200"
                          : "text-slate-600 dark:text-slate-400",
                      )}
                    >
                      {mb.amount > 0 ? formatMoney(mb.amount, displayCurrency) : "0.00"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="max-h-[calc(100dvh-18rem)] overflow-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="expense-table w-full min-w-max whitespace-nowrap text-left text-slate-700 dark:text-slate-300">
          <thead className="bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="sticky top-0 z-30 bg-slate-100 font-medium text-slate-900 dark:bg-slate-800 dark:text-slate-100">Date</th>
              <th className="sticky top-0 z-30 bg-slate-100 font-medium text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                Description
              </th>
              <th className="sticky top-0 z-30 bg-slate-100 font-medium text-slate-900 dark:bg-slate-800 dark:text-slate-100">Category</th>
              <th className="sticky top-0 z-30 bg-slate-100 font-medium text-slate-900 dark:bg-slate-800 dark:text-slate-100">Amount</th>
              <th className="sticky top-0 z-30 bg-slate-100 text-right font-medium text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
            {visibleExpenseGroups.map((group) => (
              <Fragment key={group.dateKey}>
                {groupExpensesByDate && (
                  <tr className="sticky top-10 z-20 bg-slate-100 dark:bg-slate-800">
                    <td
                      colSpan={5}
                      className="py-2 pl-3 text-sm font-semibold text-slate-800 dark:text-slate-200"
                    >
                      {group.date}
                      <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">
                        {group.expenses.length}{" "}
                        {group.expenses.length === 1 ? "expense" : "expenses"}
                      </span>
                    </td>
                  </tr>
                )}
                {group.expenses.map((expense) => {
              const category = getCategoryById(expense.categoryId);
              const isEmi = !!expense.isEmi;
              const emiMonths = expense.emiMonths ?? 1;
              const monthlyEmi = isEmi
                ? calcMonthlyEmi(expense.amount, expense.emiInterestRate ?? 0, emiMonths) +
                  (expense.emiProcessingFee ?? 0) / emiMonths +
                  (expense.emiGst ?? 0) / emiMonths
                : 0;
              return (
                <tr
                  key={expense.id}
                  className={cn(
                    "border-l-4 transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-800/40",
                    category ? getCategoryAccent(category).border : "border-l-slate-400",
                  )}
                >
                  <td className="py-2 pl-2 pr-3">
                    {groupExpensesByDate ? "" : formatDateOnly(expense.date)}
                  </td>
                  <td className="max-w-xs">
                    <div className="flex min-w-0 items-start gap-2">
                      {(expense.status ?? "pending") === "paid" ? (
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                          aria-label="Paid"
                        />
                      ) : (
                        <Clock3
                          className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
                          aria-label="Pending"
                        />
                      )}
                      <div className="flex min-w-0 flex-col gap-1">
                        {(() => {
                          const description = expense.details ?? "";
                          const merchant = [
                            { match: /\bkfc\b|kentucky fried chicken/i, label: "KFC", color: "bg-red-700 text-white" },
                            { match: /taco\s*bell/i, label: "TACO BELL", color: "bg-violet-800 text-white" },
                            { match: /\blulu\b|lulu hypermarket/i, label: "LULU", color: "bg-rose-700 text-white" },
                            { match: /starbucks/i, label: "STARBUCKS", color: "bg-emerald-900 text-white" },
                            { match: /mcdonald/i, label: "McD", color: "bg-amber-400 text-red-900" },
                            { match: /\buber\b/i, label: "UBER", color: "bg-slate-900 text-white dark:bg-slate-700" },
                            { match: /\bzomato\b/i, label: "ZOMATO", color: "bg-rose-700 text-white" },
                            { match: /\bswiggy\b/i, label: "SWIGGY", color: "bg-orange-600 text-white" },
                          ].find((brand) => brand.match.test(description));
                          return merchant ? (
                            <span
                              title={merchant.label}
                              className={cn(
                                "mb-0.5 w-fit rounded px-1.5 py-0.5 text-[9px] font-black tracking-wide",
                                merchant.color,
                              )}
                            >
                              {merchant.label}
                            </span>
                          ) : null;
                        })()}
                        {expense.details ? (
                          <span className="truncate block max-w-[200px]">{expense.details}</span>
                        ) : (
                          <span className="italic text-slate-600 text-sm">No description</span>
                        )}
                        {(isEmi || expense.recurringFrequency) && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isEmi && (
                              <button
                                type="button"
                                onClick={() => setSelectedEmiExpense(expense)}
                                aria-label={`View ${expense.emiMonths} month EMI schedule`}
                                className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/25 dark:text-amber-300"
                              >
                                EMI · {expense.emiMonths}mo
                              </button>
                            )}
                            {expense.recurringFrequency && (
                              <>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
                                  {expense.recurringFrequency.charAt(0).toUpperCase() +
                                    expense.recurringFrequency.slice(1)}
                                </span>
                                {!expense.isRecurringInstance && expenses && (
                                  <span className="text-xs text-slate-500">
                                    Next due:{" "}
                                    {(() => {
                                      const due = getNextRecurringExpenseDue(expense, expenses);
                                      return due ? formatDateOnly(formatDateInput(due)) : "Ended";
                                    })()}
                                    {expense.skipNextDue ? " (skip queued)" : ""}
                                  </span>
                                )}
                              </>
                            )}
                            {(expense.emiInterestRate ?? 0) === 0 ? (
                              <span className="text-xs text-slate-500">No Cost</span>
                            ) : (
                              <span className="text-xs text-slate-500">
                                {expense.emiInterestRate}% p.a.
                              </span>
                            )}
                            <span className="text-xs text-emerald-400 font-medium">
                              {formatMoney(
                                convertCurrency(monthlyEmi, expense.currency, displayCurrency),
                                displayCurrency,
                              )}
                              /mo
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    {category ? (
                      <Tooltip
                        content={`View ${category.title} expenses this ${mode === "yearly" ? "year" : "month"}`}
                      >
                        <button
                          onClick={() => openCategoryModal(category)}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-colors cursor-pointer",
                            getCategoryAccent(category).badge,
                          )}
                        >
                          {(() => {
                            const Icon = getCategoryIcon(category.title);
                            return <Icon className="h-3.5 w-3.5" aria-hidden="true" />;
                          })()}
                          {category.title}
                        </button>
                      </Tooltip>
                    ) : (
                      <span className="text-slate-600 text-sm italic">—</span>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-col">
                      <span>
                        {formatMoney(
                          convertCurrency(expense.amount, expense.currency, displayCurrency),
                          displayCurrency,
                        )}
                      </span>
                      {isEmi && <span className="text-xs text-slate-500">principal</span>}
                      {expense.splitItems?.length ? (
                        <span className="text-xs text-slate-500">
                          split: {expense.splitItems.length} items
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {mode === "emi" && (
                      <button
                        type="button"
                        onClick={() => setSelectedEmiExpense(expense)}
                        className="mr-3 inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 px-3 py-1.5 text-sm font-medium text-cyan-700 transition-colors hover:bg-cyan-500/10 dark:text-cyan-300"
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        View schedule
                      </button>
                    )}
                    {!expense.loanId && (
                      <Tooltip content="Edit expense">
                        <button
                          type="button"
                          onClick={() => openEditModal(expense)}
                          className="mr-3 rounded p-1.5 text-blue-500 hover:text-blue-400"
                          aria-label="Edit expense"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </Tooltip>
                    )}
                    {!expense.loanId && (expense.status ?? "pending") !== "paid" && (
                      <Tooltip content="Mark paid">
                        <button
                          type="button"
                          onClick={() => void handleMarkPaid(expense)}
                          className="mr-3 rounded p-1.5 text-emerald-700 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300"
                          aria-label="Mark expense paid"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      </Tooltip>
                    )}
                    {!expense.loanId && expense.recurringFrequency && !expense.isRecurringInstance && (
                      <button
                        type="button"
                        onClick={() => void handleSkipNext(expense)}
                        className="text-amber-700 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300 mr-3"
                      >
                        {expense.skipNextDue ? "Undo skip" : "Skip next"}
                      </button>
                    )}
                    {expense.loanId ? (
                      <span className="text-xs text-slate-500">Managed in loan schedule</span>
                    ) : (
                      <Tooltip content="Delete expense">
                        <button
                          type="button"
                          onClick={() => handleDelete(expense)}
                          className="rounded p-1.5 text-red-500 hover:text-red-400"
                          aria-label="Delete expense"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </Tooltip>
                    )}
                  </td>
                </tr>
                );
                })}
              </Fragment>
            ))}
            {filteredExpenses.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-slate-500"
                >
                  No expenses found for the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredExpenses.length > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
          <span>
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredExpenses.length)}
            of {filteredExpenses.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <AddExpenseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialExpense={expenseToEdit}
      />

      {selectedEmiExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <dialog
            open
            aria-labelledby="emi-details-title"
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            {(() => {
              const progress = getEmiProgress(selectedEmiExpense);
              const months = Math.max(1, selectedEmiExpense.emiMonths ?? 1);
              const monthlyFees =
                ((selectedEmiExpense.emiProcessingFee ?? 0) +
                  (selectedEmiExpense.emiGst ?? 0)) /
                months;
              const schedule = getEmiSchedule(
                selectedEmiExpense.amount,
                selectedEmiExpense.emiInterestRate ?? 0,
                months,
                dateOnly(selectedEmiExpense.emiStartDate ?? selectedEmiExpense.date),
              );
              const progressPercent = Math.round((progress.paidInstallments / months) * 100);
              const money = (amount: number) =>
                formatMoney(
                  convertCurrency(amount, selectedEmiExpense.currency, displayCurrency),
                  displayCurrency,
                );
              return (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2
                        id="emi-details-title"
                        className="text-xl font-semibold text-slate-900 dark:text-slate-100"
                      >
                        EMI repayment schedule
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {selectedEmiExpense.details || "Expense"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedEmiExpense(null)}
                      className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    >
                      Close
                    </button>
                  </div>
                  <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-slate-500">Principal</dt>
                      <dd className="mt-1 font-medium">{money(selectedEmiExpense.amount)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Monthly payment</dt>
                      <dd className="mt-1 font-medium">{money(progress.monthlyEmi)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Term</dt>
                      <dd className="mt-1 font-medium">
                        {months} months
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Interest rate</dt>
                      <dd className="mt-1 font-medium">
                        {selectedEmiExpense.emiInterestRate ?? 0}% p.a.
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Processing fee</dt>
                      <dd className="mt-1 font-medium">
                        {money(selectedEmiExpense.emiProcessingFee ?? 0)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">GST</dt>
                      <dd className="mt-1 font-medium">{money(selectedEmiExpense.emiGst ?? 0)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Started</dt>
                      <dd className="mt-1 font-medium">
                        {formatDateOnly(selectedEmiExpense.emiStartDate ?? selectedEmiExpense.date)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Ends</dt>
                      <dd className="mt-1 font-medium">
                        {formatDateOnly(formatDateInput(progress.end))}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Installments</dt>
                      <dd className="mt-1 font-medium">
                        {progress.paidInstallments} paid · {progress.pendingInstallments} pending
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Paid amount</dt>
                      <dd className="mt-1 font-medium">{money(progress.paidAmount)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Pending amount</dt>
                      <dd className="mt-1 font-medium">{money(progress.pendingAmount)}</dd>
                    </div>
                  </dl>
                  <div
                    className="mt-5 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                    role="progressbar"
                    aria-label="EMI repayment progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progressPercent}
                  >
                    <div
                      className="progress-fill h-full rounded-full bg-emerald-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="bg-slate-100 text-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                        <tr>
                          <th className="px-4 py-3">Payment</th>
                          <th className="px-4 py-3">Due date</th>
                          <th className="px-4 py-3">Principal</th>
                          <th className="px-4 py-3">Interest</th>
                          <th className="px-4 py-3">Payment amount</th>
                          <th className="px-4 py-3">Balance</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {schedule.map((installment) => (
                          <tr key={installment.paymentNumber}>
                            <td className="px-4 py-3">
                              {installment.paymentNumber} of {months}
                            </td>
                            <td className="px-4 py-3">{formatDateOnly(installment.dueDate)}</td>
                            <td className="px-4 py-3">{money(installment.principalAmount)}</td>
                            <td className="px-4 py-3">{money(installment.interestAmount)}</td>
                            <td className="px-4 py-3 font-medium">
                              {money(installment.paymentAmount + monthlyFees)}
                            </td>
                            <td className="px-4 py-3">{money(installment.remainingBalance)}</td>
                            <td className="px-4 py-3 capitalize">{installment.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </dialog>
        </div>
      )}

      {categoryModal.category && (
        <CategoryExpensesModal
          isOpen={categoryModal.open}
          onClose={() => setCategoryModal({ open: false, category: null })}
          category={categoryModal.category}
          selectedYear={categoryModal.year}
          selectedMonth={categoryModal.month}
        />
      )}
    </div>
  );
}
