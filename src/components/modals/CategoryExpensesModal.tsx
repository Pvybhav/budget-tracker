import { useLiveQuery } from 'dexie-react-hooks';
import { X, Tags, TrendingUp } from 'lucide-react';
import { db, type Category } from '../../db/db';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  category: Category;
}

export default function CategoryExpensesModal({ isOpen, onClose, category }: Props) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const monthExpenses = useLiveQuery(async () => {
    if (!category.id) return [];
    const all = await db.expenses.where('categoryId').equals(category.id).toArray();
    return all.filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth;
    });
  }, [category.id, currentYear, currentMonth]);

  const cards = useLiveQuery(() => db.cards.toArray());

  if (!isOpen) return null;

  const total = monthExpenses?.reduce((sum, e) => sum + e.amount, 0) ?? 0;

  const monthName = now.toLocaleString('default', { month: 'long' });

  const getCardTitle = (cardId: number) => cards?.find((c) => c.id === cardId)?.title ?? `Card #${cardId}`;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl relative flex flex-col max-h-[80vh]">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white z-10">
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
            Expenses in <span className="text-slate-300 font-medium">{monthName} {currentYear}</span>
          </p>
        </div>

        <div className="p-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3 bg-slate-800/60 rounded-xl p-4">
            <TrendingUp className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Total Spent This Month</p>
              <p className="text-2xl font-bold text-emerald-400">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {!monthExpenses || monthExpenses.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-slate-500">No expenses in {monthName} {currentYear} for this category.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {monthExpenses
                .slice()
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between gap-3 bg-slate-800/40 rounded-xl px-4 py-3 border border-slate-800 hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">
                        {expense.details || <span className="italic text-slate-500">No description</span>}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(expense.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}
                        {getCardTitle(expense.cardId)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-200 flex-shrink-0">
                      ₹{expense.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
