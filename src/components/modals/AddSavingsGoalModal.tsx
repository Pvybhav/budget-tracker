import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { type SavingsGoal } from "../../db/db";
import { createSavingsGoal, updateSavingsGoal } from "../../services/backendSync";
import showConfirm from "../../components/Confirm";
import CurrencySelect from "../CurrencySelect";
import { getDisplayCurrency } from "../../services/currency.service";
interface Props {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly initialGoal?: SavingsGoal;
}
export default function AddSavingsGoalModal({ isOpen, onClose, initialGoal }: Readonly<Props>) {
  const [formData, setFormData] = useState({
    title: "",
    targetAmount: "",
    targetDate: "",
    currentAmount: "0",
    note: "",
    currency: getDisplayCurrency(),
  });
  useEffect(() => {
    if (initialGoal) {
      setFormData({
        title: initialGoal.title,
        targetAmount: initialGoal.targetAmount.toString(),
        targetDate: initialGoal.targetDate,
        currentAmount: initialGoal.currentAmount.toString(),
        note: initialGoal.note ?? "",
        currency: initialGoal.currency ?? getDisplayCurrency(),
      });
    } else {
      setFormData({
        title: "",
        targetAmount: "",
        targetDate: "",
        currentAmount: "0",
        note: "",
        currency: getDisplayCurrency(),
      });
    }
  }, [initialGoal, isOpen]);
  if (!isOpen) return null;
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload: SavingsGoal = {
      title: formData.title.trim(),
      targetAmount: Number.parseFloat(formData.targetAmount || "0"),
      targetDate: formData.targetDate,
      currentAmount: Number.parseFloat(formData.currentAmount || "0"),
      note: formData.note.trim(),
      createdAt: initialGoal?.createdAt ?? new Date().toISOString(),
      currency: formData.currency,
    };
    if (initialGoal?.id) {
      const ok = await showConfirm(`Save changes to "${payload.title}"?`, {
        title: "Confirm update",
        confirmText: "Save changes",
      });
      if (!ok) return;
      await updateSavingsGoal(initialGoal.id, payload);
    } else {
      await createSavingsGoal(payload);
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
          <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            {" "}
            {initialGoal ? "Edit Savings Goal" : "Create Savings Goal"}{" "}
          </h2>{" "}
        </div>{" "}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {" "}
          <div>
            {" "}
            <label
              htmlFor="goal-name"
              className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1"
            >
              {" "}
              Goal Name{" "}
            </label>{" "}
            <input
              id="goal-name"
              required
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
            />{" "}
          </div>{" "}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {" "}
            <div>
              {" "}
              <label
                htmlFor="target-amount"
                className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1"
              >
                {" "}
                Target Amount{" "}
              </label>{" "}
              <div className="flex gap-2">
                <input
                  id="target-amount"
                  required
                  type="number"
                  min="0"
                  name="targetAmount"
                  value={formData.targetAmount}
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
                htmlFor="target-date"
                className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1"
              >
                {" "}
                Target Date{" "}
              </label>{" "}
              <input
                id="target-date"
                required
                type="date"
                name="targetDate"
                value={formData.targetDate}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              />{" "}
            </div>{" "}
          </div>{" "}
          <div>
            {" "}
            <label
              htmlFor="current-amount"
              className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1"
            >
              {" "}
              Current Progress{" "}
            </label>{" "}
            <input
              id="current-amount"
              type="number"
              min="0"
              name="currentAmount"
              value={formData.currentAmount}
              onChange={handleChange}
              className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
            />{" "}
          </div>{" "}
          <div>
            {" "}
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1"
            >
              {" "}
              Notes{" "}
            </label>{" "}
            <textarea
              id="notes"
              name="note"
              value={formData.note}
              onChange={handleChange}
              rows={3}
              className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
            />{" "}
          </div>{" "}
          <div className="pt-2">
            {" "}
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {" "}
              {initialGoal ? "Update Goal" : "Save Goal"}{" "}
            </button>{" "}
          </div>{" "}
        </form>{" "}
      </div>{" "}
    </div>
  );
}
