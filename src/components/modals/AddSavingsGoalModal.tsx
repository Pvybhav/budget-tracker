import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { type SavingsGoal } from "../../db/db";
import {
  createSavingsGoal,
  updateSavingsGoal,
} from "../../services/backendSync";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialGoal?: SavingsGoal;
}

export default function AddSavingsGoalModal({
  isOpen,
  onClose,
  initialGoal,
}: Props) {
  const [formData, setFormData] = useState({
    title: "",
    targetAmount: "",
    targetDate: "",
    currentAmount: "0",
    note: "",
  });

  useEffect(() => {
    if (initialGoal) {
      setFormData({
        title: initialGoal.title,
        targetAmount: initialGoal.targetAmount.toString(),
        targetDate: initialGoal.targetDate,
        currentAmount: initialGoal.currentAmount.toString(),
        note: initialGoal.note ?? "",
      });
    } else {
      setFormData({
        title: "",
        targetAmount: "",
        targetDate: "",
        currentAmount: "0",
        note: "",
      });
    }
  }, [initialGoal, isOpen]);

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: SavingsGoal = {
      title: formData.title.trim(),
      targetAmount: parseFloat(formData.targetAmount || "0"),
      targetDate: formData.targetDate,
      currentAmount: parseFloat(formData.currentAmount || "0"),
      note: formData.note.trim(),
      createdAt: initialGoal?.createdAt ?? new Date().toISOString(),
    };

    if (initialGoal?.id) {
      await updateSavingsGoal(initialGoal.id, payload);
    } else {
      await createSavingsGoal(payload);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            {initialGoal ? "Edit Savings Goal" : "Create Savings Goal"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Goal Name
            </label>
            <input
              required
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Target Amount
              </label>
              <input
                required
                type="number"
                min="0"
                name="targetAmount"
                value={formData.targetAmount}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Target Date
              </label>
              <input
                required
                type="date"
                name="targetDate"
                value={formData.targetDate}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Current Progress
            </label>
            <input
              type="number"
              min="0"
              name="currentAmount"
              value={formData.currentAmount}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Notes
            </label>
            <textarea
              name="note"
              value={formData.note}
              onChange={handleChange}
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {initialGoal ? "Update Goal" : "Save Goal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
