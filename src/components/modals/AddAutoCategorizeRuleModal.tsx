import { useEffect, useState } from "react";
import type { AutoCategorizeRule, Category } from "../../db/db";
import { createAutoCategorizeRule, updateAutoCategorizeRule } from "../../services/backendSync";
import showConfirm from "../../components/Confirm";
import { X } from "lucide-react";
interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialRule?: AutoCategorizeRule;
  categories: Category[];
}
export default function AddAutoCategorizeRuleModal({
  isOpen,
  onClose,
  initialRule,
  categories,
}: Props) {
  const [formData, setFormData] = useState({ keyword: "", categoryId: "", enabled: true });
  useEffect(() => {
    if (initialRule) {
      setFormData({
        keyword: initialRule.keyword,
        categoryId: initialRule.categoryId.toString(),
        enabled: initialRule.enabled,
      });
    } else if (isOpen) {
      setFormData({ keyword: "", categoryId: "", enabled: true });
    }
  }, [initialRule, isOpen]);
  if (!isOpen) return null;
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setFormData({ ...formData, [name]: (e.target as HTMLInputElement).checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };
  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    const payload: AutoCategorizeRule = {
      keyword: formData.keyword.trim(),
      categoryId: Number.parseInt(formData.categoryId),
      enabled: formData.enabled,
      createdAt: initialRule?.createdAt ?? new Date().toISOString(),
    };
    if (initialRule?.id) {
      const ok = await showConfirm("Save changes to this auto-categorize rule?", {
        title: "Confirm update",
        confirmText: "Save changes",
      });
      if (!ok) return;
      await updateAutoCategorizeRule(initialRule.id, payload);
    } else {
      await createAutoCategorizeRule(payload);
    }
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      {" "}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {" "}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          {" "}
          <X className="w-5 h-5" />{" "}
        </button>{" "}
        <div className="p-6 border-b border-slate-800">
          {" "}
          <h2 className="text-xl font-bold bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
            {" "}
            {initialRule ? "Edit Auto-Categorize Rule" : "Add Auto-Categorize Rule"}{" "}
          </h2>{" "}
        </div>{" "}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {" "}
          <div>
            {" "}
            <label className="block text-sm font-medium text-slate-400 mb-1">
              {" "}
              Keyword (matched in expense description){" "}
            </label>{" "}
            <input
              required
              type="text"
              name="keyword"
              placeholder="e.g. Zomato, Swiggy, Uber"
              value={formData.keyword}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
            />{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="block text-sm font-medium text-slate-400 mb-1"> Category </label>{" "}
            <select
              required
              name="categoryId"
              value={formData.categoryId}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
            >
              {" "}
              <option value="">Select a category...</option>{" "}
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {" "}
                  {category.title}{" "}
                </option>
              ))}{" "}
            </select>{" "}
          </div>{" "}
          <label className="flex items-center gap-2 text-sm text-slate-300">
            {" "}
            <input
              type="checkbox"
              name="enabled"
              checked={formData.enabled}
              onChange={handleChange}
              className="rounded border-slate-700 bg-slate-950"
            />{" "}
            Rule enabled{" "}
          </label>{" "}
          <div className="pt-2">
            {" "}
            <button
              type="submit"
              className="w-full bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {" "}
              {initialRule ? "Save Changes" : "Add Rule"}{" "}
            </button>{" "}
          </div>{" "}
        </form>{" "}
      </div>{" "}
    </div>
  );
}
