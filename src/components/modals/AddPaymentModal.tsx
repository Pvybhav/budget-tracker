import { useEffect, useState } from "react";
import type { Payment } from "../../db/db";
import { useBackendResource } from "../../services/backendHooks";
import { fetchCards } from "../../services/backend.service";
import { createPayment, updatePayment } from "../../services/backendSync";
import { X } from "lucide-react";
import showConfirm, { showAlert } from "../../components/Confirm";
import { useNavigate } from "react-router-dom";
import CurrencySelect from "../CurrencySelect";
import { formatMoney, getDisplayCurrency } from "../../services/currency.service";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialPayment?: Payment;
  defaultPayment?: Pick<Payment, "cardId" | "amount" | "currency">;
}

export default function AddPaymentModal({
  isOpen,
  onClose,
  initialPayment,
  defaultPayment,
}: Props) {
  const navigate = useNavigate();
  const cards = useBackendResource(() => fetchCards(), []);
  const [formData, setFormData] = useState({
    cardId: "",
    amount: "",
    date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16),
    currency: getDisplayCurrency(),
  });

  useEffect(() => {
    if (initialPayment) {
      const date = new Date(initialPayment.date);
      const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setFormData({
        cardId: initialPayment.cardId.toString(),
        amount: initialPayment.amount.toString(),
        date: localDate,
        currency: initialPayment.currency ?? getDisplayCurrency(),
      });
    } else if (isOpen) {
      const defaultDate = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setFormData({
        cardId: defaultPayment?.cardId ?? "",
        amount: defaultPayment?.amount?.toString() ?? "",
        date: defaultDate,
        currency: defaultPayment?.currency ?? getDisplayCurrency(),
      });
    }
  }, [
    defaultPayment?.amount,
    defaultPayment?.cardId,
    defaultPayment?.currency,
    initialPayment,
    isOpen,
  ]);

  if (!isOpen) return null;

  if (cards && cards.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
        <div className="bg-white border border-slate-200 rounded-2xl dark:bg-slate-900 dark:border-slate-800 w-full max-w-md shadow-2xl relative p-6 text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            No Cards Found
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            You need to add a credit card before recording a payment.
          </p>
          <button
            onClick={() => {
              onClose();
              navigate("/");
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Go to Dashboard to Add Card
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!formData.cardId) {
      await showAlert("Please select a card");
      return;
    }

    const payload = {
      cardId: formData.cardId,
      amount: parseFloat(formData.amount),
      date: formData.date,
      currency: formData.currency,
    };

    if (initialPayment) {
      const ok = await showConfirm(
        `Save changes to this payment of ${formatMoney(payload.amount, formData.currency)}?`,
        { title: "Confirm update", confirmText: "Save changes" },
      );
      if (!ok) return;
      await updatePayment(initialPayment.id!, payload);
    } else {
      await createPayment(payload);
    }

    onClose();
    setFormData({ ...formData, amount: "" });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-2xl dark:bg-slate-900 dark:border-slate-800 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            {initialPayment ? "Edit Payment" : "Record a Payment"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              Select Card
            </label>
            <select
              required
              name="cardId"
              value={formData.cardId}
              onChange={handleChange}
              className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-purple-500"
            >
              <option value="">Select a card...</option>
              {cards?.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.title}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                Amount Paid
              </label>
              <div className="flex gap-2">
                <input
                  required
                  type="number"
                  step="0.01"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-purple-500"
                />
                <CurrencySelect
                  value={formData.currency}
                  onChange={(currency) => setFormData({ ...formData, currency })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                Date & Time
              </label>
              <input
                required
                type="datetime-local"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
          <div className="pt-4">
            <button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {initialPayment ? "Update Payment" : "Save Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
