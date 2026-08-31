import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Card } from "../../db/db";
import { createTransfer } from "../../services/backendSync";
import { showAlert } from "../../components/Confirm";

interface Props {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly cards: Card[];
}

function todayLocal() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function AddTransferModal({ isOpen, onClose, cards }: Props) {
  const [formData, setFormData] = useState({
    fromAccountId: "",
    toAccountId: "",
    amount: "",
    date: todayLocal(),
    note: "",
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        fromAccountId: "",
        toAccountId: "",
        amount: "",
        date: todayLocal(),
        note: "",
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fromAccountId = Number.parseInt(formData.fromAccountId, 10);
    const toAccountId = Number.parseInt(formData.toAccountId, 10);
    const amount = Number.parseFloat(formData.amount || "0");
    if (!fromAccountId || !toAccountId) {
      await showAlert("Please select both accounts");
      return;
    }
    if (fromAccountId === toAccountId) {
      await showAlert("Source and destination accounts must be different");
      return;
    }
    if (!(amount > 0)) {
      await showAlert("Please enter an amount greater than zero");
      return;
    }
    await createTransfer({
      fromAccountId,
      toAccountId,
      amount,
      date: formData.date,
      note: formData.note.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 pb-0">
          <h2 className="text-xl font-bold text-slate-100">Add Transfer</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-300">
            <X className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="fromAccountId" className="block text-sm font-medium text-slate-300">
                From account
              </label>
              <select
                id="fromAccountId"
                name="fromAccountId"
                value={formData.fromAccountId}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
              >
                <option value="">Select account</option>
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="toAccountId" className="block text-sm font-medium text-slate-300">
                To account
              </label>
              <select
                id="toAccountId"
                name="toAccountId"
                value={formData.toAccountId}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
              >
                <option value="">Select account</option>
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-slate-300">
                Amount
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-slate-300">
                Date
              </label>
              <input
                id="date"
                name="date"
                type="date"
                value={formData.date}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
              />
            </div>
          </div>
          <div>
            <label htmlFor="note" className="block text-sm font-medium text-slate-300">
              Note
            </label>
            <textarea
              id="note"
              name="note"
              rows={2}
              value={formData.note}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
            >
              Save Transfer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
