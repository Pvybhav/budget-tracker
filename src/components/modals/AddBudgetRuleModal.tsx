import { useEffect, useState } from "react";
import type { BudgetRule, BudgetRulePeriod, BudgetRuleType, Card, Category } from "../../db/db";
import { createBudgetRule, updateBudgetRule } from "../../services/backendSync";
import showConfirm from "../../components/Confirm";
import { X } from "lucide-react";
import CurrencySelect from "../CurrencySelect";
import { getDisplayCurrency } from "../../services/currency.service";
interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialRule?: BudgetRule;
  categories: Category[];
  cards: Card[];
}
const TYPE_OPTIONS: { value: BudgetRuleType; label: string }[] = [
  { value: "category", label: "Category" },
  { value: "card", label: "Card" },
];
const PERIOD_OPTIONS: { value: BudgetRulePeriod; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];
export default function AddBudgetRuleModal({
  isOpen,
  onClose,
  initialRule,
  categories,
  cards,
}: Props) {
  const [formData, setFormData] = useState({
    type: "category" as BudgetRuleType,
    targetId: "",
    thresholdAmount: "",
    period: "monthly" as BudgetRulePeriod,
    enabled: true,
    note: "",
    currency: getDisplayCurrency(),
  });
  useEffect(() => {
    if (initialRule) {
      setFormData({
        type: initialRule.type,
        targetId: initialRule.targetId.toString(),
        thresholdAmount: initialRule.thresholdAmount.toString(),
        period: initialRule.period,
        enabled: initialRule.enabled,
        note: initialRule.note ?? "",
        currency: initialRule.currency ?? getDisplayCurrency(),
      });
    } else if (isOpen) {
      setFormData({
        type: "category",
        targetId: "",
        thresholdAmount: "",
        period: "monthly",
        enabled: true,
        note: "",
        currency: getDisplayCurrency(),
      });
    }
  }, [initialRule, isOpen]);
  if (!isOpen) return null;
  const options = formData.type === "category" ? categories : cards;
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setFormData({ ...formData, [name]: (e.target as HTMLInputElement).checked });
    } else if (name === "type") {
      setFormData({ ...formData, type: value as BudgetRuleType, targetId: "" });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };
  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    const payload: BudgetRule = {
      type: formData.type,
      targetId: formData.targetId,
      thresholdAmount: Number.parseFloat(formData.thresholdAmount || "0"),
      period: formData.period,
      enabled: formData.enabled,
      note: formData.note.trim() || undefined,
      createdAt: initialRule?.createdAt ?? new Date().toISOString(),
      currency: formData.currency,
    };
    if (initialRule?.id) {
      const ok = await showConfirm("Save changes to this budget rule?", {
        title: "Confirm update",
        confirmText: "Save changes",
      });
      if (!ok) return;
      await updateBudgetRule(initialRule.id, payload);
    } else {
      await createBudgetRule(payload);
    }
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      {" "}
      <div className="bg-white border border-slate-200 rounded-2xl dark:bg-slate-900 dark:border-slate-800 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {" "}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white"
        >
          {" "}
          <X className="w-5 h-5" />{" "}
        </button>{" "}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          {" "}
          <h2 className="text-xl font-bold bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
            {" "}
            {initialRule ? "Edit Budget Rule" : "Add Budget Rule"}{" "}
          </h2>{" "}
        </div>{" "}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {" "}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {" "}
            <div>
              {" "}
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                {" "}
                Applies To{" "}
              </label>{" "}
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-sky-500"
              >
                {" "}
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {" "}
                    {t.label}{" "}
                  </option>
                ))}{" "}
              </select>{" "}
            </div>{" "}
            <div>
              {" "}
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                {" "}
                {formData.type === "category" ? "Category" : "Card"}{" "}
              </label>{" "}
              <select
                required
                name="targetId"
                value={formData.targetId}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-sky-500"
              >
                {" "}
                <option value="">Select...</option>{" "}
                {options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {" "}
                    {option.title}{" "}
                  </option>
                ))}{" "}
              </select>{" "}
            </div>{" "}
          </div>{" "}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {" "}
            <div>
              {" "}
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                {" "}
                Threshold Amount{" "}
              </label>{" "}
              <div className="flex gap-2">
                <input
                  required
                  type="number"
                  min="0"
                  name="thresholdAmount"
                  value={formData.thresholdAmount}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-sky-500"
                />{" "}
                <CurrencySelect
                  value={formData.currency}
                  onChange={(currency) => setFormData((prev) => ({ ...prev, currency }))}
                />
              </div>
            </div>{" "}
            <div>
              {" "}
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                {" "}
                Period{" "}
              </label>{" "}
              <select
                name="period"
                value={formData.period}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-sky-500"
              >
                {" "}
                {PERIOD_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {" "}
                    {p.label}{" "}
                  </option>
                ))}{" "}
              </select>{" "}
            </div>{" "}
          </div>{" "}
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            {" "}
            <input
              type="checkbox"
              name="enabled"
              checked={formData.enabled}
              onChange={handleChange}
              className="rounded border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />{" "}
            Rule enabled{" "}
          </label>{" "}
          <div>
            {" "}
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              {" "}
              Notes (optional){" "}
            </label>{" "}
            <textarea
              name="note"
              value={formData.note}
              onChange={handleChange}
              rows={2}
              className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-sky-500"
            />{" "}
          </div>{" "}
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
