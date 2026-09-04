import { useEffect, useState } from "react";
import type { Bill, BillType } from "../../db/db";
import { createBill, updateBill } from "../../services/backendSync";
import showConfirm, { showAlert } from "../../components/Confirm";
import { X } from "lucide-react";
import CurrencySelect from "../CurrencySelect";
import { getDisplayCurrency } from "../../services/currency.service";
import { dateOnly, todayDateInput } from "../../utils/date";
interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialBill?: Bill;
}
const TYPE_OPTIONS: { value: BillType; label: string }[] = [
  { value: "mobile", label: "Mobile" },
  { value: "internet", label: "Internet" },
  { value: "postpaid", label: "Postpaid" },
  { value: "electricity", label: "Electricity" },
  { value: "water", label: "Water" },
  { value: "gas", label: "Gas" },
  { value: "other", label: "Other" },
];
const today = todayDateInput;
export default function AddBillModal({ isOpen, onClose, initialBill }: Readonly<Props>) {
  const [formData, setFormData] = useState({
    name: "",
    type: "mobile" as BillType,
    provider: "",
    amount: "",
    dueDate: today(),
    paid: false,
    note: "",
    isSubscription: false,
    subscriptionFrequency: "monthly" as NonNullable<Bill["subscriptionFrequency"]>,
    currency: getDisplayCurrency(),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  useEffect(() => {
    if (initialBill) {
      setFormData({
        name: initialBill.name,
        type: initialBill.type,
        provider: initialBill.provider ?? "",
        amount: initialBill.amount.toString(),
        dueDate: dateOnly(initialBill.dueDate),
        paid: initialBill.paid,
        note: initialBill.note ?? "",
        isSubscription: Boolean(initialBill.isSubscription),
        subscriptionFrequency: initialBill.subscriptionFrequency ?? "monthly",
        currency: initialBill.currency ?? getDisplayCurrency(),
      });
    } else if (isOpen) {
      setFormData({
        name: "",
        type: "mobile",
        provider: "",
        amount: "",
        dueDate: today(),
        paid: false,
        note: "",
        isSubscription: false,
        subscriptionFrequency: "monthly",
        currency: getDisplayCurrency(),
      });
    }
  }, [initialBill, isOpen]);
  if (!isOpen) return null;
  const submitLabel = isSubmitting ? "Saving..." : initialBill ? "Update Bill" : "Save Bill";
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const value =
      e.target instanceof HTMLInputElement && e.target.type === "checkbox"
        ? e.target.checked
        : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };
  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const payload: Omit<Bill, "id"> = {
      name: formData.name.trim(),
      type: formData.type,
      provider: formData.provider.trim() || undefined,
      amount: Number.parseFloat(formData.amount),
      dueDate: formData.dueDate,
      paid: formData.paid,
      note: formData.note.trim() || undefined,
      isSubscription: formData.isSubscription,
      subscriptionFrequency: formData.isSubscription ? formData.subscriptionFrequency : undefined,
      currency: formData.currency,
    };
    setIsSubmitting(true);
    try {
      if (initialBill?.id) {
        const ok = await showConfirm(`Save changes to "${payload.name}"?`, {
          title: "Confirm update",
          confirmText: "Save changes",
        });
        if (!ok) return;
        await updateBill(initialBill.id, payload);
      } else {
        await createBill(payload);
      }
      onClose();
    } catch (error) {
      await showAlert(error instanceof Error ? error.message : "Unable to save this bill.", {
        title: "Could not save bill",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      {" "}
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        {" "}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white"
          title="Close"
        >
          {" "}
          <X className="h-5 w-5" />{" "}
        </button>{" "}
        <div className="border-b border-slate-200 dark:border-slate-800 p-6">
          {" "}
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {" "}
            {initialBill ? "Edit Bill" : "Add Bill"}{" "}
          </h2>{" "}
        </div>{" "}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {" "}
          <div>
            {" "}
            <label
              htmlFor="bill-name"
              className="mb-1 block text-sm font-medium text-slate-500 dark:text-slate-400"
            >
              {" "}
              Bill Name{" "}
            </label>{" "}
            <input
              id="bill-name"
              required
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g. Home broadband"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2 text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
            />{" "}
          </div>{" "}
          <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 p-3 dark:bg-slate-950/50">
            {" "}
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              {" "}
              <input
                type="checkbox"
                name="isSubscription"
                checked={formData.isSubscription}
                onChange={handleChange}
                className="h-4 w-4 accent-emerald-500"
              />{" "}
              This is a recurring subscription{" "}
            </label>{" "}
            {formData.isSubscription && (
              <label className="block text-sm text-slate-500 dark:text-slate-400">
                {" "}
                Renewal frequency{" "}
                <select
                  name="subscriptionFrequency"
                  value={formData.subscriptionFrequency}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2 text-slate-900 dark:text-slate-100"
                >
                  {" "}
                  <option value="monthly">Monthly</option>{" "}
                  <option value="quarterly">Quarterly</option>{" "}
                  <option value="yearly">Yearly</option>{" "}
                </select>{" "}
              </label>
            )}{" "}
          </div>{" "}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {" "}
            <div>
              {" "}
              <label
                htmlFor="bill-type"
                className="mb-1 block text-sm font-medium text-slate-500 dark:text-slate-400"
              >
                {" "}
                Bill Type{" "}
              </label>{" "}
              <select
                id="bill-type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2 text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
              >
                {" "}
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {" "}
                    {option.label}{" "}
                  </option>
                ))}{" "}
              </select>{" "}
            </div>{" "}
            <div>
              {" "}
              <label
                htmlFor="bill-provider"
                className="mb-1 block text-sm font-medium text-slate-500 dark:text-slate-400"
              >
                {" "}
                Provider (optional){" "}
              </label>{" "}
              <input
                id="bill-provider"
                name="provider"
                value={formData.provider}
                onChange={handleChange}
                placeholder="e.g. Airtel"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2 text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
              />{" "}
            </div>{" "}
          </div>{" "}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {" "}
            <div>
              {" "}
              <label
                htmlFor="bill-amount"
                className="mb-1 block text-sm font-medium text-slate-500 dark:text-slate-400"
              >
                {" "}
                Amount{" "}
              </label>{" "}
              <input
                id="bill-amount"
                required
                min="0"
                step="0.01"
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2 text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
              />{" "}
            </div>{" "}
            <div>
              {" "}
              <label className="mb-1 block text-sm font-medium text-slate-500 dark:text-slate-400">
                {" "}
                Currency{" "}
              </label>{" "}
              <CurrencySelect
                value={formData.currency}
                onChange={(currency) => setFormData((prev) => ({ ...prev, currency }))}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2 text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>{" "}
            <div>
              {" "}
              <label
                htmlFor="bill-due-date"
                className="mb-1 block text-sm font-medium text-slate-500 dark:text-slate-400"
              >
                {" "}
                Due Date{" "}
              </label>{" "}
              <input
                id="bill-due-date"
                required
                type="date"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2 text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
              />{" "}
            </div>{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              {" "}
              <input
                type="checkbox"
                name="paid"
                checked={formData.paid}
                onChange={handleChange}
                className="h-4 w-4 accent-emerald-500"
              />{" "}
              Already paid{" "}
            </label>{" "}
          </div>{" "}
          <div>
            {" "}
            <label
              htmlFor="bill-note"
              className="mb-1 block text-sm font-medium text-slate-500 dark:text-slate-400"
            >
              {" "}
              Note (optional){" "}
            </label>{" "}
            <textarea
              id="bill-note"
              name="note"
              rows={2}
              value={formData.note}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2 text-slate-900 dark:text-slate-100 focus:border-emerald-500 focus:outline-none"
            />{" "}
          </div>{" "}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-700"
          >
            {" "}
            {submitLabel}{" "}
          </button>{" "}
        </form>{" "}
      </div>{" "}
    </div>
  );
}
