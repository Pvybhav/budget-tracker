import { useMemo, useState } from "react";
import { useBackendResource } from "../services/backendHooks";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { type Expense, type Category } from "../db/db";
import { calcMonthlyEmi } from "../services/card.service";
import AddExpenseModal from "../components/modals/AddExpenseModal";
import CategoryExpensesModal from "../components/modals/CategoryExpensesModal";
import { fetchExpenses, fetchCategories } from "../services/backend.service";
import showConfirm from "../components/Confirm";
import { deleteExpense } from "../services/backendSync";

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function ManageExpensesPage({
  mode,
}: {
  mode?: "monthly" | "yearly" | "emi";
}) {
  const expenses = useBackendResource(() => fetchExpenses(), []);
  const categories = useBackendResource(() => fetchCategories(), []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | undefined>(
    undefined,
  );

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<
    "date-desc" | "date-asc" | "amount-desc" | "amount-asc"
  >("date-desc");
  const [showEmiOnly, setShowEmiOnly] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");

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
        expenseDate.getFullYear() === selectedYear &&
        expenseDate.getMonth() + 1 === selectedMonth
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
        new Date(expense.date).toLocaleDateString(),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        normalizedQuery.length === 0 || haystack.includes(normalizedQuery);
      const matchesCategory =
        selectedCategoryId === "all" ||
        expense.categoryId?.toString() === selectedCategoryId;
      const matchesEmi = !showEmiOnly || !!expense.isEmi;

      return matchesSearch && matchesCategory && matchesEmi;
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
    showEmiOnly,
    sortBy,
  ]);

  const totalAmount =
    filteredExpenses?.reduce((sum, expense) => sum + expense.amount, 0) || 0;

  const expenseCount = filteredExpenses?.length || 0;
  const emiCount =
    filteredExpenses?.filter((expense) => expense.isEmi).length || 0;
  const biggestExpense = filteredExpenses?.reduce<Expense | undefined>(
    (max, expense) => {
      if (!max || expense.amount > max.amount) return expense;
      return max;
    },
    undefined,
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
            amount: monthExpenses?.reduce((sum, e) => sum + e.amount, 0) || 0,
          };
        })
      : [];

  const getCategoryById = (id?: number): Category | undefined => {
    if (!id) return undefined;
    return categories?.find((c) => c.id === id);
  };

  const handleDelete = async (expense: Expense) => {
    const ok = await showConfirm(
      "Are you sure you want to delete this expense?",
      { title: "Delete expense" },
    );
    if (ok) {
      await deleteExpense(expense.id!);
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
      month: selectedMonth,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold text-slate-100">
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
          <div className="font-semibold mb-1">Completed</div>
          <div className="text-slate-400">
            EMI repayment cycle finished for this expense.
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          <div className="font-semibold mb-1">Ongoing</div>
          <div className="text-slate-300">
            EMI is active and current this month.
          </div>
        </div>
        <div className="rounded-2xl border border-sky-500/25 bg-sky-500/10 p-4 text-sm text-sky-200">
          <div className="font-semibold mb-1">Upcoming</div>
          <div className="text-slate-300">EMI starts in a future month.</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {mode !== "emi" && (
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
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
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
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
        <label className="flex flex-col gap-2 text-sm text-slate-400">
          <span>Search expenses</span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by description, category, amount..."
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-400">
          <span>Category</span>
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
          >
            <option value="all">All categories</option>
            {categories?.map((category) => (
              <option key={category.id} value={category.id?.toString()}>
                {category.title}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-400">
          <span>Sort by</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500"
          >
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="amount-desc">Highest amount</option>
            <option value="amount-asc">Lowest amount</option>
          </select>
        </label>

        <div className="flex flex-col gap-2 text-sm text-slate-400">
          <span>Quick filters</span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowEmiOnly((prev) => !prev)}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 font-medium transition-colors",
                showEmiOnly
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600",
              )}
            >
              {showEmiOnly ? "EMI only" : "All expenses"}
            </button>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategoryId("all");
                setSortBy("date-desc");
                setShowEmiOnly(false);
              }}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-300 transition-colors hover:border-slate-600"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">
            {mode === "monthly"
              ? "Month Total"
              : mode === "yearly"
                ? "Year Total"
                : "Visible Total"}
          </p>
          <p className="text-3xl font-bold text-emerald-400">
            ₹{totalAmount.toLocaleString()}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">
            Transactions
          </p>
          <p className="text-3xl font-bold text-slate-100">{expenseCount}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">
            EMI Count
          </p>
          <p className="text-3xl font-bold text-amber-400">{emiCount}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">
            Largest Spend
          </p>
          <p className="text-3xl font-bold text-sky-400">
            ₹
            {(biggestExpense?.amount ?? 0).toLocaleString("en-IN", {
              maximumFractionDigits: 0,
            })}
          </p>
          <p className="mt-2 text-sm text-slate-500 truncate">
            {biggestExpense?.details || "No expense yet"}
          </p>
        </div>
      </div>

      {mode && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">
              {mode === "monthly" ? "Month Total" : "Year Total"}
            </p>
            <p className="text-3xl font-bold text-emerald-400">
              ₹{totalAmount.toLocaleString()}
            </p>
          </div>

          {mode === "yearly" && (
            <div className="md:col-span-3 bg-slate-900 border border-slate-800 p-6 rounded-2xl overflow-x-auto">
              <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-4">
                Monthly Breakdown
              </p>
              <div className="flex gap-6 min-w-max pb-2">
                {monthlyBreakdown.map((mb) => (
                  <div key={mb.name} className="flex flex-col items-center">
                    <div className="text-xs text-slate-500 mb-1">{mb.name}</div>
                    <div
                      className={cn(
                        "text-sm font-semibold",
                        mb.amount > 0 ? "text-slate-200" : "text-slate-700",
                      )}
                    >
                      ₹{mb.amount > 0 ? mb.amount.toLocaleString() : "0"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-slate-300 whitespace-nowrap min-w-max">
          <thead className="bg-slate-800/50">
            <tr>
              <th className="px-6 py-4 font-medium">Date</th>
              <th className="px-6 py-4 font-medium">Description</th>
              <th className="px-6 py-4 font-medium">Category</th>
              <th className="px-6 py-4 font-medium">Card ID</th>
              <th className="px-6 py-4 font-medium">Amount</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filteredExpenses.map((expense) => {
              const category = getCategoryById(expense.categoryId);
              const isEmi = !!expense.isEmi;
              const emiMonths = expense.emiMonths ?? 1;
              const monthlyEmi = isEmi
                ? calcMonthlyEmi(
                    expense.amount,
                    expense.emiInterestRate ?? 0,
                    emiMonths,
                  ) +
                  (expense.emiProcessingFee ?? 0) / emiMonths +
                  (expense.emiGst ?? 0) / emiMonths
                : 0;
              return (
                <tr
                  key={expense.id}
                  className="hover:bg-slate-800/20 transition-colors"
                >
                  <td className="px-6 py-4">
                    {new Date(expense.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 max-w-xs">
                    <div className="flex flex-col gap-1">
                      {expense.details ? (
                        <span className="truncate block max-w-[200px]">
                          {expense.details}
                        </span>
                      ) : (
                        <span className="italic text-slate-600 text-sm">
                          No description
                        </span>
                      )}
                      {(isEmi || expense.recurringFrequency) && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isEmi && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium">
                              EMI · {expense.emiMonths}mo
                            </span>
                          )}
                          {expense.recurringFrequency && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
                              {expense.recurringFrequency
                                .charAt(0)
                                .toUpperCase() +
                                expense.recurringFrequency.slice(1)}
                            </span>
                          )}
                          {(expense.emiInterestRate ?? 0) === 0 ? (
                            <span className="text-xs text-slate-500">
                              No Cost
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">
                              {expense.emiInterestRate}% p.a.
                            </span>
                          )}
                          <span className="text-xs text-emerald-400 font-medium">
                            ₹
                            {monthlyEmi.toLocaleString("en-IN", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}
                            /mo
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {category ? (
                      <button
                        onClick={() => openCategoryModal(category)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-medium hover:bg-violet-500/25 hover:border-violet-400/50 transition-colors cursor-pointer"
                        title={`View ${category.title} expenses this month`}
                      >
                        {category.title}
                      </button>
                    ) : (
                      <span className="text-slate-600 text-sm italic">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">{expense.cardId}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span>
                        ₹
                        {expense.amount.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      {isEmi && (
                        <span className="text-xs text-slate-500">
                          principal
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {isEmi ? (
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${(() => {
                          const status = getEmiExpenseStatus(expense);
                          if (status === "completed") {
                            return "bg-slate-700 text-slate-300";
                          }
                          if (status === "current") {
                            return "bg-emerald-500/15 text-emerald-300";
                          }
                          return "bg-sky-500/15 text-sky-300";
                        })()}`}
                      >
                        {getEmiExpenseStatus(expense) === "completed"
                          ? "Completed"
                          : getEmiExpenseStatus(expense) === "current"
                            ? "Ongoing"
                            : "Upcoming"}
                      </span>
                    ) : (
                      <span className="text-slate-500 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openEditModal(expense)}
                      className="text-blue-400 hover:text-blue-300 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(expense)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredExpenses.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-slate-500"
                >
                  No expenses found for the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AddExpenseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialExpense={expenseToEdit}
      />

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
