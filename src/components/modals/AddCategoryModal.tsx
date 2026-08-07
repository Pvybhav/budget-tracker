import { useState, useEffect } from 'react';
import { X, Eye } from 'lucide-react';
import { db, type Category } from '../../db/db';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: Category;
}

function fmtPreview(n: number) {
  if (n >= 1000) return '₹' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return '₹' + n.toFixed(0);
}

export default function AddCategoryModal({ isOpen, onClose, initialCategory }: Props) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    budgetAmount: '',
    budgetMode: 'monthly' as 'monthly' | 'yearly',
    hasBudget: false,
  });

  useEffect(() => {
    if (initialCategory) {
      setFormData({
        title: initialCategory.title,
        description: initialCategory.description ?? '',
        budgetAmount: initialCategory.budgetAmount?.toString() ?? '',
        budgetMode: (initialCategory.budgetMode as 'monthly' | 'yearly') ?? 'monthly',
        hasBudget: initialCategory.budgetAmount != null,
      });
    } else {
      setFormData({
        title: '',
        description: '',
        budgetAmount: '',
        budgetMode: 'monthly',
        hasBudget: false,
      });
    }
  }, [initialCategory, isOpen]);

  if (!isOpen) return null;

  const budgetValue = parseFloat(formData.budgetAmount) || 0;

  // Derived previews (never stored)
  const previews = (() => {
    if (!budgetValue) return null;
    if (formData.budgetMode === 'monthly') {
      return {
        daily: budgetValue / 30,
        weekly: budgetValue / (52 / 12),
      };
    }
    // yearly
    return {
      monthly: budgetValue / 12,
      weekly: budgetValue / 52,
      daily: budgetValue / 365,
    };
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Category = {
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      budgetAmount: formData.hasBudget && formData.budgetAmount ? budgetValue : undefined,
      budgetMode: formData.hasBudget && formData.budgetAmount ? formData.budgetMode : undefined,
    };

    if (initialCategory?.id) {
      await db.categories.update(initialCategory.id, payload);
    } else {
      await db.categories.add(payload);
    }
    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
            {initialCategory ? 'Edit Category' : 'Add Category'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Title <span className="text-red-400">*</span></label>
            <input
              required
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Food & Dining"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-violet-500 placeholder-slate-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Description <span className="text-slate-600 text-xs">(optional)</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={2}
              placeholder="Short description..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-violet-500 placeholder-slate-500 resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="hasBudget"
              checked={formData.hasBudget}
              onChange={(e) => setFormData({ ...formData, hasBudget: e.target.checked })}
              className="w-4 h-4 accent-violet-500"
            />
            <label htmlFor="hasBudget" className="text-sm font-medium text-slate-300 cursor-pointer select-none">
              Set a budget for this category
            </label>
          </div>

          {formData.hasBudget && (
            <div className="space-y-3 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
              {/* Amount + Mode row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Budget Amount <span className="text-red-400">*</span>
                  </label>
                  <input
                    required={formData.hasBudget}
                    type="number"
                    step="0.01"
                    min="0"
                    name="budgetAmount"
                    value={formData.budgetAmount}
                    onChange={handleChange}
                    placeholder="0.00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-violet-500 placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Budget Mode</label>
                  <select
                    name="budgetMode"
                    value={formData.budgetMode}
                    onChange={handleChange}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              {/* Derived previews */}
              {previews && (
                <div className="bg-slate-900/60 rounded-lg border border-slate-700 px-3 py-2.5">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Eye className="w-3 h-3" /> Breakdown Preview
                    <span className="normal-case font-normal text-slate-600 ml-1">(not stored)</span>
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {'monthly' in previews && (
                      <span className="text-slate-400">
                        Monthly: <span className="text-slate-200 font-semibold">{fmtPreview(previews.monthly!)}</span>
                      </span>
                    )}
                    {'weekly' in previews && previews.weekly != null && (
                      <span className="text-slate-400">
                        Weekly: <span className="text-slate-200 font-semibold">{fmtPreview(previews.weekly)}</span>
                      </span>
                    )}
                    {'daily' in previews && previews.daily != null && (
                      <span className="text-slate-400">
                        Daily: <span className="text-slate-200 font-semibold">{fmtPreview(previews.daily)}</span>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {initialCategory ? 'Update Category' : 'Save Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
