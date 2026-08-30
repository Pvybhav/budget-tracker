import { useBackendResource } from "../../services/backendHooks";
import { X, Tags, TrendingUp } from "lucide-react";
import { type Category } from "../../db/db";
import { fetchExpenses, fetchCards } from "../../services/backend.service";

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
  const now = new Date();
  const currentYear = selectedYear ?? now.getFullYear();
  const currentMonth = selectedMonth ?? now.getMonth() + 1;
  const periodMode = budgetMode ?? (selectedMonth === undefined ? "yearly" : "monthly");
  const isYearly = periodMode === "yearly";
  const isQuarterly = periodMode === "quarterly";
  const currentQuarterIndex = Math.floor((currentMonth - 1) / 3);

  const monthExpenses = useBackendResource(async () => {
    if (!category.id) return [];
    const all = await fetchExpenses();
    return all.filter((e) => {
      const d = new Date(e.date);
      return (
        e.categoryId === category.id &&
        d.getFullYear() === currentYear &&
        (isYearly ||
          (isQuarterly
            ? Math.floor(d.getMonth() / 3) === currentQuarterIndex
            : d.getMonth() + 1 === currentMonth))
      );
    });
  }, [category.id, currentYear, currentMonth, isYearly, isQuarterly, currentQuarterIndex]);

  const cards = useBackendResource(() => fetchCards(), []);

  if (!isOpen) return null;

  const total = monthExpenses?.reduce((sum, e) => sum + e.amount, 0) ?? 0;

  const periodName = isYearly
    ? `the year ${currentYear}`
    : isQuarterly
      ? `Q${currentQuarterIndex + 1} ${currentYear}`
      : `${new Date(currentYear, currentMonth! - 1).toLocaleString("default", { month: "long" })} ${currentYear}`;

  const sortedExpenses = (monthExpenses ?? [])
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const expensesByMonth = sortedExpenses.reduce<
    { month: number; expenses: typeof sortedExpenses }[]
  >((groups, expense) => {
    const month = new Date(expense.date).getMonth();
    const group = groups.find((item) => item.month === month);
    if (group) {
      group.expenses.push(expense);
    } else {
      groups.push({ month, expenses: [expense] });
    }
    return groups;
  }, []);

  const getCardTitle = (cardId: number) =>
    cards?.find((c) => c.id === cardId)?.title ?? `Card #${cardId}`;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl relative flex flex-col max-h-[80vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
              <Tags className="w-4 h-4 text-violet-400" />
            </span>
            <h2 className="text-xl font-bold text-slate-100">{category.title}</h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Expenses in <span className="text-slate-300 font-medium">{periodName}</span>
          </p>
        </div>

        <div className="p-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3 bg-slate-800/60 rounded-xl p-4">
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
                ₹
                {total.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-4 pb-4">
          {!monthExpenses || monthExpenses.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-slate-500">No expenses in {periodName} for this category.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(isYearly ? expensesByMonth : [{ month: -1, expenses: sortedExpenses }]).map(
                (group) => (
                  <div key={group.month} className="space-y-2">
                    {isYearly && (
                      <h3 className="sticky top-0 z-20 flex items-center justify-between gap-3 rounded-lg border border-slate-700 border-l-4 border-l-emerald-400 bg-slate-800/95 px-3 py-2.5 text-sm font-semibold text-slate-100 shadow-lg shadow-slate-950/30 backdrop-blur">
                        <span className="truncate">
                          {new Date(currentYear, group.month, 1).toLocaleString("default", {
                            month: "long",
                          })}
                        </span>
                        <span className="shrink-0 rounded-md bg-emerald-400/10 px-2 py-1 text-xs font-bold text-emerald-300">
                          ₹
                          {group.expenses
                            .reduce((sum, expense) => sum + expense.amount, 0)
                            .toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                        </span>
                      </h3>
                    )}
                    {group.expenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="flex items-center justify-between gap-3 bg-slate-800/40 rounded-xl px-4 py-3 border border-slate-800 hover:border-slate-700 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-200 truncate">
                            {expense.details || (
                              <span className="italic text-slate-500">No description</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {new Date(expense.date).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                            {" · "}
                            {getCardTitle(expense.cardId)}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-200 flex-shrink-0">
                          ₹
                          {expense.amount.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
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
