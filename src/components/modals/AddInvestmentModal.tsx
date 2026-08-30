import { useEffect, useState } from "react";
import type { Investment, InvestmentType } from "../../db/db";
import { createInvestment, updateInvestment } from "../../services/backendSync";
import { X } from "lucide-react";
interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialInvestment?: Investment;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
export default function AddInvestmentModal({
  isOpen,
  onClose,
  initialInvestment,
}: Readonly<Props>) {
  const [formData, setFormData] = useState({
    name: "",
    platform: "",
    type: "equity" as InvestmentType,
    quantity: "",
    investedAmount: "",
    currentValue: "",
    purchaseDate: today(),
    note: "",
  });
  useEffect(() => {
    if (!isOpen) return;
    setFormData({
      name: initialInvestment?.name ?? "",
      platform: initialInvestment?.platform ?? "",
      type: initialInvestment?.type ?? "equity",
      quantity: initialInvestment?.quantity.toString() ?? "",
      investedAmount: initialInvestment?.investedAmount.toString() ?? "",
      currentValue: initialInvestment?.currentValue.toString() ?? "",
      purchaseDate: initialInvestment?.purchaseDate ?? today(),
      note: initialInvestment?.note ?? "",
    });
  }, [initialInvestment, isOpen]);
  if (!isOpen) return null;
  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setFormData({ ...formData, [event.target.name]: event.target.value });
  };
  const handleSubmit = async (event: React.SubmitEvent) => {
    event.preventDefault();
    const quantity = Number.parseFloat(formData.quantity || "0");
    const investedAmount = Number.parseFloat(formData.investedAmount || "0");
    const currentValue = Number.parseFloat(formData.currentValue || "0");
    if (
      !formData.name.trim() ||
      !formData.platform.trim() ||
      !Number.isFinite(quantity) ||
      quantity < 0 ||
      !Number.isFinite(investedAmount) ||
      investedAmount < 0 ||
      !Number.isFinite(currentValue) ||
      currentValue < 0
    ) {
      return;
    }
    const payload: Omit<Investment, "id"> = {
      name: formData.name.trim(),
      platform: formData.platform.trim(),
      type: formData.type,
      quantity,
      investedAmount,
      currentValue,
      purchaseDate: formData.purchaseDate,
      note: formData.note.trim() || undefined,
    };
    if (initialInvestment?.id) {
      await updateInvestment(initialInvestment.id, payload);
    } else {
      await createInvestment(payload);
    }
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      {" "}
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {" "}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white"
          title="Close"
        >
          {" "}
          <X className="h-5 w-5" />{" "}
        </button>{" "}
        <div className="border-b border-slate-800 p-6">
          {" "}
          <h2 className="text-xl font-bold text-slate-100">
            {" "}
            {initialInvestment ? "Edit Investment" : "Add Investment"}{" "}
          </h2>{" "}
          <p className="mt-1 text-sm text-slate-400">
            {" "}
            Record the latest value from your investment platform.{" "}
          </p>{" "}
        </div>{" "}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {" "}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {" "}
            <label className="text-sm text-slate-400">
              {" "}
              Investment name{" "}
              <input
                required
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. HDFC Flexi Cap"
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-500"
              />{" "}
            </label>{" "}
            <label className="text-sm text-slate-400">
              {" "}
              Platform / broker{" "}
              <input
                required
                name="platform"
                value={formData.platform}
                onChange={handleChange}
                placeholder="e.g. Zerodha"
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-500"
              />{" "}
            </label>{" "}
          </div>{" "}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {" "}
            <label className="text-sm text-slate-400">
              {" "}
              Instrument type{" "}
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-500"
              >
                {" "}
                <option value="equity">Equity</option>{" "}
                <option value="mutual-fund">Mutual Fund</option> <option value="etf">ETF</option>{" "}
                <option value="bond">Bond</option> <option value="other">Other</option>{" "}
              </select>{" "}
            </label>{" "}
            <label className="text-sm text-slate-400">
              {" "}
              Quantity / units{" "}
              <input
                required
                min="0"
                step="0.0001"
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-500"
              />{" "}
            </label>{" "}
          </div>{" "}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {" "}
            <label className="text-sm text-slate-400">
              {" "}
              Invested amount (₹){" "}
              <input
                required
                min="0"
                step="0.01"
                type="number"
                name="investedAmount"
                value={formData.investedAmount}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-500"
              />{" "}
            </label>{" "}
            <label className="text-sm text-slate-400">
              {" "}
              Current value (₹){" "}
              <input
                required
                min="0"
                step="0.01"
                type="number"
                name="currentValue"
                value={formData.currentValue}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-500"
              />{" "}
            </label>{" "}
          </div>{" "}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {" "}
            <label className="text-sm text-slate-400">
              {" "}
              Purchase date{" "}
              <input
                required
                type="date"
                name="purchaseDate"
                value={formData.purchaseDate}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-500"
              />{" "}
            </label>{" "}
            <label className="text-sm text-slate-400">
              {" "}
              Note{" "}
              <input
                name="note"
                value={formData.note}
                onChange={handleChange}
                placeholder="Optional"
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-500"
              />{" "}
            </label>{" "}
          </div>{" "}
          <button
            type="submit"
            className="w-full rounded-lg bg-cyan-600 px-4 py-2 font-medium text-white transition-colors hover:bg-cyan-700"
          >
            {" "}
            {initialInvestment ? "Update Investment" : "Save Investment"}{" "}
          </button>{" "}
        </form>{" "}
      </div>{" "}
    </div>
  );
}
