import { useEffect, useState } from "react";
import type { Income } from "../../db/db";
import { useBackendResource } from "../../services/backendHooks";
import { fetchCards } from "../../services/backend.service";
import { createIncome, updateIncome } from "../../services/backendSync";
import { syncRecurringIncomes } from "../../services/recurring.service";
import { X } from "lucide-react";
import showConfirm, { showAlert } from "../../components/Confirm";
import CurrencySelect from "../CurrencySelect";
import { getDisplayCurrency } from "../../services/currency.service";
import { currentDateTimeInput } from "../../utils/date";
interface Props {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly initialIncome?: Income;
}
const INCOME_CATEGORIES: { value: NonNullable<Income["category"]>; label: string }[] = [
  { value: "salary", label: "Salary" },
  { value: "freelance", label: "Freelance" },
  { value: "business", label: "Business" },
  { value: "interest", label: "Interest" },
  { value: "dividend", label: "Dividend" },
  { value: "refund", label: "Refund" },
  { value: "gift", label: "Gift" },
  { value: "other", label: "Other" },
];
function nowLocal() {
  return currentDateTimeInput();
}
export default function AddIncomeModal({ isOpen, onClose, initialIncome }: Readonly<Props>) {
  const cards = useBackendResource(() => fetchCards(), []);
  const [formData, setFormData] = useState({
    source: "",
    category: "salary" as NonNullable<Income["category"]>,
    accountId: "",
    amount: "",
    date: nowLocal(),
    note: "",
    isRecurring: false,
    recurringFrequency: "monthly" as NonNullable<Income["recurringFrequency"]>,
    recurringInterval: 1,
    recurringEndDate: "",
    currency: getDisplayCurrency(),
  });
  useEffect(() => {
    if (initialIncome) {
      const date = new Date(initialIncome.date);
      const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setFormData({
        source: initialIncome.source,
        category: initialIncome.category ?? "other",
        accountId: initialIncome.accountId?.toString() ?? "",
        amount: initialIncome.amount.toString(),
        date: localDate,
        note: initialIncome.note ?? "",
        isRecurring: Boolean(initialIncome.recurringFrequency),
        recurringFrequency: initialIncome.recurringFrequency ?? "monthly",
        recurringInterval: initialIncome.recurringInterval ?? 1,
        recurringEndDate: initialIncome.recurringEndDate ?? "",
        currency: initialIncome.currency ?? getDisplayCurrency(),
      });
    } else if (isOpen) {
      setFormData({
        source: "",
        category: "salary",
        accountId: "",
        amount: "",
        date: nowLocal(),
        note: "",
        isRecurring: false,
        recurringFrequency: "monthly",
        recurringInterval: 1,
        recurringEndDate: "",
        currency: getDisplayCurrency(),
      });
    }
  }, [initialIncome, isOpen]);
  if (!isOpen) return null;
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };
  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.source.trim()) {
      await showAlert("Please enter an income source");
      return;
    }
    const payload: Income = {
      source: formData.source.trim(),
      category: formData.category,
      accountId: formData.accountId || undefined,
      amount: Number.parseFloat(formData.amount || "0"),
      date: formData.date,
      note: formData.note.trim() || undefined,
      recurringFrequency: formData.isRecurring ? formData.recurringFrequency : undefined,
      recurringInterval: formData.isRecurring ? formData.recurringInterval : undefined,
      recurringEndDate: formData.isRecurring ? formData.recurringEndDate || undefined : undefined,
      currency: formData.currency,
    };
    if (initialIncome?.id) {
      const ok = await showConfirm(`Save changes to "${payload.source}"?`, {
        title: "Confirm update",
        confirmText: "Save changes",
      });
      if (!ok) return;
      await updateIncome(initialIncome.id, payload);
    } else {
      await createIncome(payload);
    }
    if (formData.isRecurring) {
      await syncRecurringIncomes();
    }
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      {" "}
      <div className="bg-white border border-slate-200 rounded-2xl dark:bg-slate-900 dark:border-slate-800 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {" "}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white"
        >
          {" "}
          <X className="w-5 h-5" />{" "}
        </button>{" "}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          {" "}
          <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            {" "}
            {initialIncome ? "Edit Income" : "Record Income"}{" "}
          </h2>{" "}
        </div>{" "}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {" "}
          <div>
            {" "}
            <label
              htmlFor="income-source"
              className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1"
            >
              {" "}
              Source{" "}
            </label>{" "}
            <input
              id="income-source"
              required
              type="text"
              name="source"
              placeholder="e.g. Honeywell Salary, Freelance project"
              value={formData.source}
              onChange={handleChange}
              className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
            />{" "}
          </div>{" "}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {" "}
            <div>
              {" "}
              <label
                htmlFor="income-category"
                className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1"
              >
                {" "}
                Category{" "}
              </label>{" "}
              <select
                id="income-category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                {" "}
                {INCOME_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {" "}
                    {c.label}{" "}
                  </option>
                ))}{" "}
              </select>{" "}
            </div>{" "}
            <div>
              {" "}
              <label
                htmlFor="credited-to"
                className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1"
              >
                {" "}
                Credited To (optional){" "}
              </label>{" "}
              <select
                id="credited-to"
                name="accountId"
                value={formData.accountId}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                {" "}
                <option value="">Unassigned</option>{" "}
                {cards?.map((card) => (
                  <option key={card.id} value={card.id}>
                    {" "}
                    {card.title}{" "}
                  </option>
                ))}{" "}
              </select>{" "}
            </div>{" "}
          </div>{" "}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {" "}
            <div>
              {" "}
              <label
                htmlFor="income-amount"
                className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1"
              >
                {" "}
                Amount{" "}
              </label>{" "}
              <div className="flex gap-2">
                <input
                  id="income-amount"
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                />{" "}
                <CurrencySelect
                  value={formData.currency}
                  onChange={(currency) => setFormData((prev) => ({ ...prev, currency }))}
                  className="bg-white border border-slate-300 rounded-lg px-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 text-sm"
                />
              </div>{" "}
            </div>{" "}
            <div>
              {" "}
              <label
                htmlFor="income-date"
                className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1"
              >
                {" "}
                Date{" "}
              </label>{" "}
              <input
                id="income-date"
                required
                type="datetime-local"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              />{" "}
            </div>{" "}
          </div>{" "}
          <div>
            {" "}
            <label
              htmlFor="income-notes"
              className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1"
            >
              {" "}
              Notes{" "}
            </label>{" "}
            <textarea
              id="income-notes"
              name="note"
              value={formData.note}
              onChange={handleChange}
              rows={2}
              className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
            />{" "}
          </div>{" "}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 p-3 dark:bg-slate-950/50 space-y-3">
            {" "}
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              {" "}
              <input
                type="checkbox"
                name="isRecurring"
                checked={formData.isRecurring}
                onChange={handleChange}
                className="rounded border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />{" "}
              Recurring income (e.g. monthly salary){" "}
            </label>{" "}
            {formData.isRecurring && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {" "}
                <div>
                  {" "}
                  <label
                    htmlFor="recurring-frequency"
                    className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
                  >
                    {" "}
                    Frequency{" "}
                  </label>{" "}
                  <select
                    id="recurring-frequency"
                    name="recurringFrequency"
                    value={formData.recurringFrequency}
                    onChange={handleChange}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {" "}
                    <option value="monthly">Monthly</option> <option value="weekly">Weekly</option>{" "}
                    <option value="yearly">Yearly</option>{" "}
                  </select>{" "}
                </div>{" "}
                <div>
                  {" "}
                  <label
                    htmlFor="recurring-interval"
                    className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
                  >
                    {" "}
                    Every{" "}
                  </label>{" "}
                  <input
                    id="recurring-interval"
                    type="number"
                    min="1"
                    name="recurringInterval"
                    value={formData.recurringInterval}
                    onChange={handleChange}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                  />{" "}
                </div>{" "}
                <div>
                  {" "}
                  <label
                    htmlFor="recurring-end-date"
                    className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
                  >
                    {" "}
                    End date (optional){" "}
                  </label>{" "}
                  <input
                    id="recurring-end-date"
                    type="date"
                    name="recurringEndDate"
                    value={formData.recurringEndDate}
                    onChange={handleChange}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                  />{" "}
                </div>{" "}
              </div>
            )}{" "}
          </div>{" "}
          <div className="pt-2">
            {" "}
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {" "}
              {initialIncome ? "Update Income" : "Save Income"}{" "}
            </button>{" "}
          </div>{" "}
        </form>{" "}
      </div>{" "}
    </div>
  );
}
