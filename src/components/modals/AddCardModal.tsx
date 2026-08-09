import React, { useState, useEffect } from "react";
import { type AccountType, type Card } from "../../db/db";
import { createCard, updateCard } from "../../services/backendSync";
import { X } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialCard?: Card;
}

export default function AddCardModal({ isOpen, onClose, initialCard }: Props) {
  const [formData, setFormData] = useState({
    title: "",
    type: "credit" as AccountType,
    billingDate: "",
    paymentDate: "",
    totalLimit: "",
    amc: "0",
    waiveOffLimit: "0",
  });

  useEffect(() => {
    if (initialCard) {
      setFormData({
        title: initialCard.title,
        type: initialCard.type ?? "credit",
        billingDate: initialCard.billingDate?.toString() ?? "",
        paymentDate: initialCard.paymentDate?.toString() ?? "",
        totalLimit: initialCard.totalLimit.toString(),
        amc: initialCard.amc?.toString() ?? "0",
        waiveOffLimit: initialCard.waiveOffLimit?.toString() ?? "0",
      });
    } else {
      setFormData({
        title: "",
        type: "credit",
        billingDate: "",
        paymentDate: "",
        totalLimit: "",
        amc: "0",
        waiveOffLimit: "0",
      });
    }
  }, [initialCard, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isCreditAccount = formData.type === "credit";
    const payload = {
      title: formData.title,
      type: formData.type,
      billingDate: isCreditAccount
        ? parseInt(formData.billingDate || "0", 10)
        : 0,
      paymentDate: isCreditAccount
        ? parseInt(formData.paymentDate || "0", 10)
        : 0,
      totalLimit: parseFloat(formData.totalLimit || "0"),
      amc: isCreditAccount ? parseFloat(formData.amc || "0") : 0,
      waiveOffLimit: isCreditAccount
        ? parseFloat(formData.waiveOffLimit || "0")
        : 0,
    };

    if (initialCard) {
      await updateCard(initialCard.id!, payload);
    } else {
      await createCard(payload);
    }
    onClose();
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
          <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            {initialCard ? "Edit Card" : "Add New Card"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Account Name
            </label>
            <input
              required
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              Account Type
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="credit">Credit Card</option>
              <option value="debit">Debit Card</option>
              <option value="meal">Meal Card</option>
              <option value="wallet">UPI Wallet</option>
              <option value="other">Other</option>
            </select>
          </div>
          {formData.type === "credit" ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Billing Date (1-31)
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    max="31"
                    name="billingDate"
                    value={formData.billingDate}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Payment Date (1-31)
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    max="31"
                    name="paymentDate"
                    value={formData.paymentDate}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    AMC
                  </label>
                  <input
                    required
                    type="number"
                    name="amc"
                    value={formData.amc}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Spent to Waive AMC
                  </label>
                  <input
                    required
                    type="number"
                    name="waiveOffLimit"
                    value={formData.waiveOffLimit}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-400">
              This account type uses a balance-based view, so billing dates and
              AMC settings are not required.
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              {formData.type === "credit" ? "Total Limit" : "Starting Balance"}
            </label>
            <input
              required
              type="number"
              name="totalLimit"
              value={formData.totalLimit}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="pt-4">
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {initialCard ? "Update Account" : "Save Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
