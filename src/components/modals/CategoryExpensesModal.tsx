import { useBackendResource } from "../../services/backendHooks";
import { X, Tags, TrendingUp } from "lucide-react";
import { type Category, type Expense } from "../../db/db";
import { fetchExpenses, fetchCards } from "../../services/backend.service";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../../services/currency.service";
import { dateOnly, formatDateInput, formatDateOnly, parseDateOnly } from "../../utils/date";
import { getCategoryAccent } from "../../utils/categoryTheme";
import { getEmiSchedule } from "../../services/card.service";

interface PeriodExpenseEntry {
  expense: Expense;
  date: string;
  amount: number;
  month: number;
  installmentLabel?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  category: Category;
  selectedYear?: number;
  selectedMonth?: number;
  budgetMode?: Category["budgetMode"];
}

export default function CategoryExpensesModal({
  isOpen,
  onClose,
  category,
  selectedYear,
  selectedMonth,
  budgetMode,
}: Props) {
  const displayCurrency = useDisplayCurrency();
  const now = new Date();
  const currentYear = selectedYear ?? now.getFullYear();
  const currentMonth = selectedMonth ?? now.getMonth() + 1;
  const periodMode = budgetMode ?? (selectedMonth === undefined ? "yearly" : "monthly");
  const isYearly = periodMode === "yearly";
  const isQuarterly = periodMode === "quarterly";
  const currentQuarterIndex = Math.floor((currentMonth - 1) / 3);
  const periodStart = isYearly
    ? new Date(currentYear, 0, 1)
    : isQuarterly
      ? new Date(currentYear, currentQuarterIndex * 3, 1)
      : new Date(currentYear, currentMonth - 1, 1);
  const periodEnd = isYearly
    ? new Date(currentYear + 1, 0, 1)
    : isQuarterly
      ? new Date(currentYear, currentQuarterIndex * 3 + 3, 1)
      : new Date(currentYear, currentMonth, 1);
  const periodStartKey = formatDateInput(periodStart);
  const periodEndKey = formatDateInput(periodEnd);

  const categoryExpenses = useBackendResource(async () => {
    if (!category.id) return [];
    const all = await fetchExpenses();
    return all.filter((expense) => expense.categoryId === category.id);
  }, [category.id]);

  const cards = useBackendResource(() => fetchCards(), []);
  const accent = getCategoryAccent(category);

  if (!isOpen) return null;

  const periodEntries: PeriodExpenseEntry[] = (categoryExpenses ?? []).flatMap((expense) => {
    if (expense.isEmi) {
      const months = Math.max(1, expense.emiMonths ?? 1);
      const monthlyFees =
        ((expense.emiProcessingFee ?? 0) + (expense.emiGst ?? 0)) / months;
      return getEmiSchedule(
        expense.amount,
        expense.emiInterestRate ?? 0,
        months,
        dateOnly(expense.emiStartDate ?? expense.date),
      )
        .filter(
          (installment) =>
            installment.dueDate >= periodStartKey && installment.dueDate < periodEndKey,
        )
        .map((installment) => ({
          expense,
          date: installment.dueDate,
          amount: installment.paymentAmount + monthlyFees,
          month: parseDateOnly(installment.dueDate)?.getMonth() ?? 0,
          installmentLabel: `EMI payment ${installment.paymentNumber} of ${months}`,
        }));
    }

    const date = dateOnly(expense.date);
    if (date < periodStartKey || date >= periodEndKey) return [];
    return [
      {
        expense,
        date,
        amount: expense.amount,
        month: parseDateOnly(date)?.getMonth() ?? 0,
      },
    ];
  });

  const total = periodEntries.reduce(
    (sum, entry) =>
      sum + convertCurrency(entry.amount, entry.expense.currency, displayCurrency),
    0,
  );

  const periodName = isYearly
    ? `the year ${currentYear}`
    : isQuarterly
      ? `Q${currentQuarterIndex + 1} ${currentYear}`
      : `${new Date(currentYear, currentMonth! - 1).toLocaleString("default", { month: "long" })} ${currentYear}`;

  const sortedEntries = periodEntries
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  const expensesByMonth = sortedEntries.reduce<
    { month: number; entries: typeof sortedEntries }[]
  >((groups, expense) => {
    const month = expense.month;
    const group = groups.find((item) => item.month === month);
    if (group) {
      group.entries.push(expense);
    } else {
      groups.push({ month, entries: [expense] });
    }
    return groups;
  }, []);

  const getCardTitle = (cardId: string) =>
    cards?.find((c) => c.id === cardId)?.title ?? "Unknown card";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-2xl dark:bg-slate-900 dark:border-slate-800 w-full max-w-lg shadow-2xl relative flex flex-col max-h-[80vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <span
              className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${accent.icon}`}
            >
              <Tags className="w-4 h-4" />
            </span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {category.title}
            </h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Expenses in{" "}
            <span className="text-slate-700 dark:text-slate-300 font-medium">{periodName}</span>
          </p>
        </div>

        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl p-4">
            <TrendingUp className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                {isYearly
                  ? "Total Spent This Year"
                  : isQuarterly
                    ? "Total Spent This Quarter"
                    : "Total Spent This Month"}
              </p>
              <p className="text-2xl font-bold text-emerald-400">
                {formatMoney(total, displayCurrency)}
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-4 pb-4">
          {!categoryExpenses || periodEntries.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-slate-500">No expenses in {periodName} for this category.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(isYearly ? expensesByMonth : [{ month: -1, entries: sortedEntries }]).map(
                (group) => (
                  <div key={group.month} className="space-y-2">
                    {isYearly && (
                      <h3 className="sticky top-0 z-20 flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 border-l-4 border-l-emerald-400 bg-slate-100 dark:bg-slate-800/95 px-3 py-2.5 text-sm font-semibold text-slate-900 dark:text-slate-100 shadow-lg shadow-slate-950/30 backdrop-blur">
                        <span className="truncate">
                          {new Date(currentYear, group.month, 1).toLocaleString("default", {
                            month: "long",
                          })}
                        </span>
                        <span className="shrink-0 rounded-md bg-emerald-400/10 px-2 py-1 text-xs font-bold text-emerald-300">
                          {formatMoney(
                            group.entries.reduce(
                              (sum, entry) =>
                                sum +
                                convertCurrency(
                                  entry.amount,
                                  entry.expense.currency,
                                  displayCurrency,
                                ),
                              0,
                            ),
                            displayCurrency,
                          )}
                        </span>
                      </h3>
                    )}
                    {group.entries.map((entry, index) => (
                      <div
                        key={`${entry.expense.id}-${entry.date}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 transition-colors hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/40"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                            {entry.expense.details || (
                              <span className="italic text-slate-500">No description</span>
                            )}
                            {entry.installmentLabel && (
                              <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-300">
                                {entry.installmentLabel}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {formatDateOnly(entry.date)}
                            {" · "}
                            {entry.expense.cardId
                              ? getCardTitle(entry.expense.cardId)
                              : "No account"}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-shrink-0">
                          {formatMoney(
                            convertCurrency(
                              entry.amount,
                              entry.expense.currency,
                              displayCurrency,
                            ),
                            displayCurrency,
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
