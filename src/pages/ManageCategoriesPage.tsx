import { useState, useMemo } from "react";
import { useBackendResource } from "../services/backendHooks";
import { Tags, Pencil, Trash2, Plus, Wallet } from "lucide-react";
import { type Category } from "../db/db";
import showConfirm from "../components/Confirm";
import AddCategoryModal from "../components/modals/AddCategoryModal";
import CategoryExpensesModal from "../components/modals/CategoryExpensesModal";
import BudgetForecastPanel from "../components/BudgetForecastPanel";
import { getBudgetStatus } from "../services/budget.service";
import { forecastAllCategoryBudgets } from "../services/budget-forecast.service";
import { deleteCategory } from "../services/backendSync";
import { fetchCategories, fetchExpenses } from "../services/backend.service";
import SmartBudgetRecommendationsPanel from "../components/SmartBudgetRecommendationsPanel";
import BudgetCarryoverPanel from "../components/BudgetCarryoverPanel";
import { getSmartBudgetRecommendations } from "../services/budget-recommendations.service";
import { calculateCategoryCarryovers } from "../services/budget-carryover.service";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
import PaginationControls from "../components/PaginationControls";

const BUDGET_MODE_LABELS: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

const BUDGET_MODE_COLORS: Record<string, string> = {
  monthly: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  quarterly: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  yearly: "text-sky-400 bg-sky-400/10 border-sky-400/30",
};

function fmtPreview(n: number, currency: string) {
  if (n >= 1000)
    return formatMoney(n / 1000, currency)
      .replace(/\.00$/, "")
      .concat("k");
  return formatMoney(n, currency);
}

function getBudgetPreviews(category: Category, currency: string): string | null {
  const { budgetAmount: amt, budgetMode: mode } = category;
  if (amt == null || !mode) return null;
  if (mode === "monthly") {
    return `≈ ${fmtPreview(amt / (52 / 12), currency)}/wk · ${fmtPreview(amt / 30, currency)}/day`;
  }
  if (mode === "quarterly") {
    return `≈ ${fmtPreview(amt / 3, currency)}/mo · ${fmtPreview(amt / (52 / 4), currency)}/wk · ${fmtPreview(amt / (365 / 4), currency)}/day`;
  }
  // yearly
  return `≈ ${fmtPreview(amt / 12, currency)}/mo · ${fmtPreview(amt / 52, currency)}/wk · ${fmtPreview(amt / 365, currency)}/day`;
}

export default function ManageCategoriesPage() {
  const displayCurrency = useDisplayCurrency();
  const categories = useBackendResource(() => fetchCategories(), []);
  const expenses = useBackendResource(() => fetchExpenses(), []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<Category | undefined>(undefined);
  const [categoryForExpenses, setCategoryForExpenses] = useState<Category | null>(null);
  const [compactMode, setCompactMode] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 9;
  const visibleCategories = (categories ?? []).slice((page - 1) * pageSize, page * pageSize);

  const budgetForecasts = useMemo(() => {
    if (!categories || !expenses) return [];
    return forecastAllCategoryBudgets(categories, expenses, displayCurrency);
  }, [categories, expenses, displayCurrency]);
  const recommendations = useMemo(() => {
    if (!categories || !expenses) return [];
    return getSmartBudgetRecommendations(categories, expenses, 6, displayCurrency);
  }, [categories, expenses, displayCurrency]);
  const carryovers = useMemo(() => {
    if (!categories || !expenses) return [];
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevMonthStart = new Date(prevYear, prevMonth, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const prevMonthSpent = new Map<string, number>();
    expenses.forEach((exp) => {
      const expDate = new Date(exp.date);
      if (expDate >= prevMonthStart && expDate <= prevMonthEnd) {
        const current = prevMonthSpent.get(exp.categoryId ?? "") ?? 0;
        prevMonthSpent.set(
          exp.categoryId ?? "",
          current + convertCurrency(exp.amount, exp.currency, displayCurrency),
        );
      }
    });
    return calculateCategoryCarryovers(
      categories.map((c) => ({ ...c, enableCarryover: true })),
      prevMonthSpent,
      displayCurrency,
    );
  }, [categories, expenses, displayCurrency]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const { monthlySpentMap, quarterlySpentMap, yearlySpentMap, expenseCountMap, lastExpenseMap } =
    useMemo(() => {
      const monthly = new Map<string, number>();
      const quarterly = new Map<string, number>();
      const yearly = new Map<string, number>();
      const counts = new Map<string, number>();
      const last = new Map<string, string>();
      if (!expenses)
        return {
          monthlySpentMap: monthly,
          quarterlySpentMap: quarterly,
          yearlySpentMap: yearly,
          expenseCountMap: counts,
          lastExpenseMap: last,
        };
      for (const e of expenses) {
        if (!e.categoryId) continue;
        const cid = e.categoryId;
        const d = new Date(e.date);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const category = categories?.find((item) => item.id === cid);
        const budgetMode = category?.budgetMode ?? "yearly";
        const currentQuarterIndex = Math.floor((currentMonth - 1) / 3);
        const isCurrentPeriod =
          y === currentYear &&
          (budgetMode === "yearly" ||
            (budgetMode === "monthly" && m === currentMonth) ||
            (budgetMode === "quarterly" && Math.floor((m - 1) / 3) === currentQuarterIndex));

        if (y === currentYear) {
          yearly.set(
            cid,
            (yearly.get(cid) || 0) + convertCurrency(e.amount, e.currency, displayCurrency),
          );
        }
        if (y === currentYear) {
          if (m === currentMonth) {
            monthly.set(
              cid,
              (monthly.get(cid) || 0) + convertCurrency(e.amount, e.currency, displayCurrency),
            );
          }
          // Quarter calculation: determine quarter start month for currentMonth
          const currentQuarterIndex = Math.floor((currentMonth - 1) / 3);
          const quarterStart = currentQuarterIndex * 3 + 1;
          const quarterMonths = [quarterStart, quarterStart + 1, quarterStart + 2];
          if (quarterMonths.includes(m)) {
            quarterly.set(
              cid,
              (quarterly.get(cid) || 0) + convertCurrency(e.amount, e.currency, displayCurrency),
            );
          }
        }
        if (isCurrentPeriod) counts.set(cid, (counts.get(cid) || 0) + 1);
        const prev = last.get(cid);
        if (!prev || new Date(e.date) > new Date(prev)) last.set(cid, e.date);
      }
      return {
        monthlySpentMap: monthly,
        quarterlySpentMap: quarterly,
        yearlySpentMap: yearly,
        expenseCountMap: counts,
        lastExpenseMap: last,
      };
    }, [categories, expenses, currentYear, currentMonth, displayCurrency]);

  const openAddModal = () => {
    setCategoryToEdit(undefined);
    setIsModalOpen(true);
  };

  const openEditModal = (category: Category) => {
    setCategoryToEdit(category);
    setIsModalOpen(true);
  };

  const openCategoryExpenses = (category: Category) => {
    setCategoryForExpenses(category);
  };

  const handleDelete = async (category: Category) => {
    const ok = await showConfirm(
      `Delete category "${category.title}"? Expenses using this category will lose their category assignment.`,
      { title: "Delete category" },
    );
    if (!ok) return;
    await deleteCategory(category.id!);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            Manage Categories
          </h1>
          <p className="text-slate-600 mt-1 text-sm dark:text-slate-400">
            Organise your expenses into categories with optional budgets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>

          <button
            onClick={() => setCompactMode((c) => !c)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors border ${compactMode ? "bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-slate-100 border-blue-300 dark:border-slate-700" : "bg-transparent text-slate-700 dark:text-slate-300 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            title="Toggle compact mode"
          >
            <span className="text-sm font-medium">{compactMode ? "Compact" : "Expanded"}</span>
          </button>
        </div>
      </div>
      {categories && categories.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Tags className="w-12 h-12 text-slate-500 mx-auto mb-4 dark:text-slate-600" />
          <h3 className="text-lg font-medium text-slate-800 mb-2 dark:text-slate-300">
            No categories yet
          </h3>
          <p className="text-slate-600 mb-6 text-sm dark:text-slate-500">
            Create categories to organise your expenses and track budgets.
          </p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Your First Category
          </button>
        </div>
      )}
      {categories && categories.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleCategories.map((category) => {
            const previews = getBudgetPreviews(category, displayCurrency);
            return (
              <div
                key={category.id}
                className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl ${compactMode ? "p-3 gap-2 text-sm" : "p-5 gap-3"} hover:border-slate-300 dark:hover:border-slate-700 transition-colors min-h-[120px] flex flex-col`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                      <Tags className="w-4 h-4 text-violet-400" />
                    </span>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {category.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEditModal(category)}
                      className="p-1.5 text-slate-500 hover:text-blue-400 transition-colors rounded-lg hover:bg-slate-800"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(category)}
                      className="p-1.5 text-slate-500 hover:text-red-400 transition-colors rounded-lg hover:bg-slate-800"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="min-h-[36px] mt-1">
                  {compactMode ? (
                    <div className="text-xs text-slate-700 dark:text-slate-400 flex items-center gap-3">
                      <button
                        onClick={() => openCategoryExpenses(category)}
                        className="text-left hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                      >
                        {expenseCountMap.get(category.id!) ?? 0} expenses
                      </button>
                      {lastExpenseMap.get(category.id!) && (
                        <div>
                          ·{" "}
                          {new Date(lastExpenseMap.get(category.id!)!).toLocaleString("default", {
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm text-slate-700 dark:text-slate-400 leading-relaxed">
                        {category.description ?? (
                          <span className="text-transparent">placeholder</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-400 mt-2 flex items-center gap-3">
                        <button
                          onClick={() => openCategoryExpenses(category)}
                          className="text-left hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                        >
                          {expenseCountMap.get(category.id!) ?? 0} expenses
                        </button>
                        {lastExpenseMap.get(category.id!) && (
                          <div>
                            ·{" "}
                            {new Date(lastExpenseMap.get(category.id!)!).toLocaleString("default", {
                              month: "short",
                              day: "numeric",
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {category.budgetAmount != null && category.budgetMode ? (
                  <div className="mt-auto space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                        {formatMoney(category.budgetAmount, displayCurrency)}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border font-medium ${BUDGET_MODE_COLORS[category.budgetMode] ?? ""}`}
                      >
                        {BUDGET_MODE_LABELS[category.budgetMode] ?? category.budgetMode}
                      </span>
                    </div>
                    {!compactMode && previews && (
                      <p className="text-xs text-slate-500 pl-5">{previews}</p>
                    )}

                    {/* Budget usage bar */}
                    <div className="mt-3 pl-5">
                      {(() => {
                        const spent =
                          category.budgetMode === "yearly"
                            ? (yearlySpentMap.get(category.id!) ?? 0)
                            : category.budgetMode === "quarterly"
                              ? (quarterlySpentMap.get(category.id!) ?? 0)
                              : (monthlySpentMap.get(category.id!) ?? 0);
                        const budget = category.budgetAmount ?? 0;
                        const budgetStatus = getBudgetStatus(spent, budget);
                        const over = budgetStatus.isOverBudget;
                        const nearLimit = budgetStatus.isNearLimit;
                        return (
                          <div>
                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                              <div className="font-medium text-slate-700 dark:text-slate-300">
                                Budget usage
                              </div>
                              <div
                                className={`font-semibold ${over ? "text-red-400" : nearLimit ? "text-amber-400" : "text-emerald-400"}`}
                              >
                                {budgetStatus.progressClamped}%
                              </div>
                            </div>

                            <div
                              className={`w-full bg-slate-200 dark:bg-slate-800 rounded-full ${compactMode ? "h-2" : "h-3"} overflow-hidden border border-slate-300 dark:border-slate-700`}
                            >
                              <div
                                style={{
                                  width: `${Math.min(100, budgetStatus.progressClamped)}%`,
                                }}
                                className={`${over ? "bg-red-500" : nearLimit ? "bg-amber-500" : "bg-emerald-400"} ${compactMode ? "h-2" : "h-3"} transition-all duration-300`}
                              />
                            </div>

                            <div className="flex items-center justify-between text-xs text-slate-500 mt-2 gap-2">
                              <div>{formatMoney(spent, displayCurrency)}</div>
                              <div
                                className={`${over ? "text-red-400 font-medium" : nearLimit ? "text-amber-400 font-medium" : "text-slate-400"}`}
                              >
                                {over
                                  ? `Over by ${formatMoney(Math.abs(budgetStatus.remaining), displayCurrency)}`
                                  : `${formatMoney(Math.max(0, budgetStatus.remaining), displayCurrency)} left`}
                              </div>
                            </div>
                            <div
                              className={`mt-1 text-[11px] ${over ? "text-red-400" : nearLimit ? "text-amber-400" : "text-emerald-400"}`}
                            >
                              {budgetStatus.statusLabel}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="mt-auto">
                    <span className="text-xs text-slate-600 italic">No budget set</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <PaginationControls
        page={page}
        totalItems={categories?.length ?? 0}
        pageSize={pageSize}
        onPageChange={setPage}
      />
      {categories && categories.length > 0 && budgetForecasts.length > 0 && (
        <BudgetForecastPanel forecasts={budgetForecasts} />
      )}

      {recommendations.length > 0 && (
        <SmartBudgetRecommendationsPanel recommendations={recommendations} />
      )}
      {carryovers.length > 0 && <BudgetCarryoverPanel carryovers={carryovers} />}
      <AddCategoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialCategory={categoryToEdit}
      />
      {categoryForExpenses && (
        <CategoryExpensesModal
          isOpen={true}
          onClose={() => setCategoryForExpenses(null)}
          category={categoryForExpenses}
          budgetMode={categoryForExpenses.budgetMode ?? "yearly"}
        />
      )}
    </div>
  );
}
