import { useEffect, useMemo, useState } from "react";
import { useBackendResource } from "../services/backendHooks";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { type Expense, type Category } from "../db/db";
import { calcMonthlyEmi } from "../services/card.service";
import AddExpenseModal from "../components/modals/AddExpenseModal";
import CategoryExpensesModal from "../components/modals/CategoryExpensesModal";
import { fetchCards, fetchExpenses, fetchCategories } from "../services/backend.service";
import showConfirm from "../components/Confirm";
import { deleteExpense, updateExpense } from "../services/backendSync";
import { getNextRecurringExpenseDue, syncRecurringExpenses } from "../services/recurring.service";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
import { formatDateInput, formatDateOnly } from "../utils/date";
import { getCategoryAccent } from "../utils/categoryTheme";
import Tooltip from "../components/Tooltip";
import { getCategoryIcon } from "../utils/categoryIcons";
import { Check, CheckCircle2, Clock3, Pencil, Trash2 } from "lucide-react";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

function getEmiProgress(expense: Expense) {
  const months = Math.max(1, expense.emiMonths ?? 1);
  const start = new Date(expense.date);
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
  ]);

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

  const getEmiExpenseStatus = (expense: Expense) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(expense.date);
    start.setHours(0, 0, 0, 0);
    const months = expense.emiMonths ?? 1;
    const end = new Date(start);
    end.setMonth(end.getMonth() + months - 1);
    end.setHours(0, 0, 0, 0);

    if (today < start) {
      return "upcoming" as const;
    }
    if (today > end) {
      return "completed" as const;
    }
    return "current" as const;
  };

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
      const matchesEmi = !showEmiOnly || !!expense.isEmi;

      return matchesSearch && matchesCategory && matchesCard && matchesEmi;
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
    sortBy,
  ]);
  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / pageSize));
  const visibleExpenses = filteredExpenses.slice((page - 1) * pageSize, page * pageSize);

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

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr_1fr_1fr] gap-4">
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
            {categories?.map((category) => (
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
            {cards?.map((card) => (
              <option key={card.id} value={card.id?.toString()}>
                {card.title}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-400">
          <span>Quick filters</span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowEmiOnly((prev) => !prev)}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 font-medium transition-colors",
                showEmiOnly
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                  : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600",
              )}
            >
              {showEmiOnly ? "EMI only" : "All expenses"}
            </button>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategoryId("all");
                setSelectedCardId("all");
                setSortBy("date-desc");
                setShowEmiOnly(false);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-700 dark:text-slate-300 transition-colors hover:border-slate-400 dark:hover:border-slate-600"
            >
              Reset
            </button>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
            <p className="text-slate-600 dark:text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">
              {mode === "monthly"
                ? "Month Total"
                : mode === "yearly"
                  ? "Year Total"
                  : "Visible Total"}
            </p>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatMoney(totalAmount, displayCurrency)}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
            <p className="text-slate-600 dark:text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">
              Transactions
            </p>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{expenseCount}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
            <p className="text-slate-600 dark:text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">
              EMI Count
            </p>
            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{emiCount}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
            <p className="text-slate-600 dark:text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">
              Largest Spend
            </p>
            <p className="text-3xl font-bold text-sky-600 dark:text-sky-400">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl">
            <p className="text-slate-600 dark:text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">
              {mode === "monthly" ? "Month Total" : "Year Total"}
            </p>
            <p className="text-3xl font-bold text-emerald-400">
              {formatMoney(totalAmount, displayCurrency)}
            </p>
          </div>

          {mode === "yearly" && (
            <div className="md:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl overflow-x-auto">
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

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-max">
          <thead className="bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">Date</th>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                Description
              </th>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">Category</th>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">Amount</th>
              {mode === "emi" && (
                <>
                  <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                    End date
                  </th>
                  <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">Paid</th>
                  <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                    Pending
                  </th>
                  <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                    Status
                  </th>
                </>
              )}
              <th className="px-6 py-4 font-medium text-right text-slate-900 dark:text-slate-100">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
            {visibleExpenses.map((expense) => {
              const category = getCategoryById(expense.categoryId);
              const isEmi = !!expense.isEmi;
              const emiMonths = expense.emiMonths ?? 1;
              const monthlyEmi = isEmi
                ? calcMonthlyEmi(expense.amount, expense.emiInterestRate ?? 0, emiMonths) +
                  (expense.emiProcessingFee ?? 0) / emiMonths +
                  (expense.emiGst ?? 0) / emiMonths
                : 0;
              const emiProgress = isEmi ? getEmiProgress(expense) : null;
              const emiStatus = isEmi ? getEmiExpenseStatus(expense) : null;

              return (
                <tr key={expense.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4">{formatDateOnly(expense.date)}</td>
                  <td className="px-6 py-4 max-w-xs">
                    <div className="flex items-start gap-2">
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
                        {expense.details ? (
                          <span className="truncate block max-w-[200px]">{expense.details}</span>
                        ) : (
                          <span className="italic text-slate-600 text-sm">No description</span>
                        )}
                        {(isEmi || expense.recurringFrequency) && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isEmi && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-medium">
                                EMI · {expense.emiMonths}mo
                              </span>
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
                  <td className="px-6 py-4">
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
                  <td className="px-6 py-4">
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
                  {mode === "emi" && emiProgress && (
                    <>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                        {formatDateOnly(formatDateInput(emiProgress.end))}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {emiProgress.paidInstallments}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {formatMoney(
                              convertCurrency(
                                emiProgress.paidAmount,
                                expense.currency,
                                displayCurrency,
                              ),
                              displayCurrency,
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {emiProgress.pendingInstallments}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {formatMoney(
                              convertCurrency(
                                emiProgress.pendingAmount,
                                expense.currency,
                                displayCurrency,
                              ),
                              displayCurrency,
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${(() => {
                            if (emiStatus === "completed") {
                              return "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
                            }
                            if (emiStatus === "current") {
                              return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
                            }
                            return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
                          })()}`}
                        >
                          {emiStatus === "completed"
                            ? "Completed"
                            : emiStatus === "current"
                              ? "Ongoing"
                              : "Upcoming"}
                        </span>
                      </td>
                    </>
                  )}
                  <td className="px-6 py-4 text-right">
                    {mode === "emi" && (
                      <button
                        type="button"
                        onClick={() => setSelectedEmiExpense(expense)}
                        className="mr-3 text-cyan-700 hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300"
                      >
                        View details
                      </button>
                    )}
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
                    {(expense.status ?? "pending") !== "paid" && (
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
                    {expense.recurringFrequency && !expense.isRecurringInstance && (
                      <button
                        type="button"
                        onClick={() => void handleSkipNext(expense)}
                        className="text-amber-700 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300 mr-3"
                      >
                        {expense.skipNextDue ? "Undo skip" : "Skip next"}
                      </button>
                    )}
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
                  </td>
                </tr>
              );
            })}
            {filteredExpenses.length === 0 && (
              <tr>
                <td
                  colSpan={mode === "emi" ? 9 : 5}
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
            className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            {(() => {
              const progress = getEmiProgress(selectedEmiExpense);
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
                        EMI details
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
                        {selectedEmiExpense.emiMonths ?? 1} months
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
                        {formatDateOnly(selectedEmiExpense.date)}
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
                  <progress
                    className="mt-5 h-2 w-full accent-emerald-500"
                    aria-label="EMI repayment progress"
                    max={100}
                    value={Math.round(
                      (progress.paidInstallments / Math.max(1, selectedEmiExpense.emiMonths ?? 1)) *
                        100,
                    )}
                  />
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
