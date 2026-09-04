import { useEffect, useState } from "react";
import type {
  FundClassification,
  Investment,
  InvestmentSubtype,
  InvestmentType,
} from "../../db/db";
import { createInvestment, updateInvestment } from "../../services/backendSync";
import { X } from "lucide-react";
import CurrencySelect from "../CurrencySelect";
import { getDisplayCurrency } from "../../services/currency.service";
import { inferFundClassification } from "../../utils/fundClassification";
interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialInvestment?: Investment;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
const investmentPlatforms = [
  "Zerodha",
  "5Paisa",
  "Groww",
  "Upstox",
  "Angel One",
  "ICICI Direct",
  "HDFC Securities",
  "Other",
];
const subtypeOptions: { value: InvestmentSubtype; label: string }[] = [
  { value: "equity", label: "Equity fund" },
  { value: "debt", label: "Debt fund" },
  { value: "index", label: "Index fund" },
  { value: "hybrid", label: "Hybrid fund" },
  { value: "solution-oriented", label: "Solution-oriented" },
  { value: "pf", label: "PF" },
  { value: "vpf", label: "VPF" },
  { value: "nps", label: "NPS" },
  { value: "other", label: "Other" },
];
const classificationOptions: { value: FundClassification; label: string }[] = [
  { value: "large-cap", label: "Large cap" },
  { value: "mid-cap", label: "Mid cap" },
  { value: "small-cap", label: "Small cap" },
  { value: "flexi-cap", label: "Flexi cap" },
  { value: "multi-cap", label: "Multi cap" },
  { value: "other", label: "Other" },
];
export default function AddInvestmentModal({
  isOpen,
  onClose,
  initialInvestment,
}: Readonly<Props>) {
  const [formData, setFormData] = useState({
    name: "",
    platform: "",
    type: "equity" as InvestmentType,
    subtype: "equity" as InvestmentSubtype,
    classification: "other" as FundClassification,
    quantity: "",
    investedAmount: "",
    currentValue: "",
    purchaseDate: today(),
    note: "",
    currency: getDisplayCurrency(),
  });
  useEffect(() => {
    if (!isOpen) return;
    setFormData({
      name: initialInvestment?.name ?? "",
      platform: initialInvestment?.platform ?? "",
      type: initialInvestment?.type ?? "equity",
      subtype: initialInvestment?.subtype ?? "other",
      classification: initialInvestment?.classification ?? "other",
      quantity: initialInvestment?.quantity.toString() ?? "",
      investedAmount: initialInvestment?.investedAmount.toString() ?? "",
      currentValue: initialInvestment?.currentValue.toString() ?? "",
      purchaseDate: initialInvestment?.purchaseDate ?? today(),
      note: initialInvestment?.note ?? "",
      currency: initialInvestment?.currency ?? getDisplayCurrency(),
    });
  }, [initialInvestment, isOpen]);
  if (!isOpen) return null;
  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "name" && previous.classification === "other"
        ? { classification: inferFundClassification(value) ?? previous.classification }
        : {}),
    }));
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
      subtype:
        formData.type === "mutual-fund" || formData.type === "retirement"
          ? formData.subtype
          : undefined,
      classification:
        formData.type === "mutual-fund" || formData.type === "equity"
          ? formData.classification
          : undefined,
      quantity,
      investedAmount,
      currentValue,
      purchaseDate: formData.purchaseDate,
      note: formData.note.trim() || undefined,
      currency: formData.currency,
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
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl max-h-[90vh] overflow-y-auto">
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
            {initialInvestment ? "Edit Investment" : "Add Investment"}{" "}
          </h2>{" "}
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {" "}
            Record the latest value from your investment platform.{" "}
          </p>{" "}
        </div>{" "}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {" "}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {" "}
            <label className="text-sm text-slate-500 dark:text-slate-400">
              {" "}
              Investment name{" "}
              <input
                required
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. HDFC Flexi Cap"
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-500"
              />{" "}
            </label>{" "}
            <label className="text-sm text-slate-500 dark:text-slate-400">
              {" "}
              Platform / broker{" "}
              <select
                required
                name="platform"
                value={formData.platform}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500"
              >
                <option value="">Select a platform...</option>
                {formData.platform && !investmentPlatforms.includes(formData.platform) && (
                  <option value={formData.platform}>{formData.platform}</option>
                )}
                {investmentPlatforms.map((platform) => (
                  <option key={platform} value={platform}>
                    {platform}
                  </option>
                ))}
              </select>{" "}
            </label>{" "}
          </div>{" "}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {" "}
            <label className="text-sm text-slate-500 dark:text-slate-400">
              {" "}
              Instrument type{" "}
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500"
              >
                {" "}
                <option value="equity">Equity</option>{" "}
                <option value="mutual-fund">Mutual Fund</option> <option value="etf">ETF</option>{" "}
                <option value="bond">Bond</option> <option value="other">Other</option>{" "}
                <option value="retirement">Retirement savings</option>{" "}
              </select>{" "}
            </label>{" "}
            {(formData.type === "mutual-fund" || formData.type === "retirement") && (
              <label className="text-sm text-slate-500 dark:text-slate-400">
                {formData.type === "retirement" ? "Retirement vehicle" : "Fund subtype"}
                <select
                  name="subtype"
                  value={formData.subtype}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 outline-none focus:border-cyan-500"
                >
                  {subtypeOptions
                    .filter((option) =>
                      formData.type === "retirement"
                        ? ["pf", "vpf", "nps", "other"].includes(option.value)
                        : !["pf", "vpf", "nps"].includes(option.value),
                    )
                    .map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                </select>
              </label>
            )}{" "}
            {(formData.type === "mutual-fund" || formData.type === "equity") && (
              <label className="text-sm text-slate-500 dark:text-slate-400">
                Fund classification
                <select
                  name="classification"
                  value={formData.classification}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 outline-none focus:border-cyan-500"
                >
                  {classificationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}{" "}
            <label className="text-sm text-slate-500 dark:text-slate-400">
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
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500"
              />{" "}
            </label>{" "}
          </div>{" "}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {" "}
            <label className="text-sm text-slate-500 dark:text-slate-400">
              {" "}
              Invested amount{" "}
              <input
                required
                min="0"
                step="0.01"
                type="number"
                name="investedAmount"
                value={formData.investedAmount}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500"
              />{" "}
            </label>{" "}
            <label className="text-sm text-slate-500 dark:text-slate-400">
              {" "}
              Current value{" "}
              <input
                required
                min="0"
                step="0.01"
                type="number"
                name="currentValue"
                value={formData.currentValue}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500"
              />{" "}
            </label>{" "}
            <label className="text-sm text-slate-500 dark:text-slate-400">
              {" "}
              Currency{" "}
              <CurrencySelect
                value={formData.currency}
                onChange={(currency) => setFormData((prev) => ({ ...prev, currency }))}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500"
              />
            </label>{" "}
          </div>{" "}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {" "}
            <label className="text-sm text-slate-500 dark:text-slate-400">
              {" "}
              Purchase date{" "}
              <input
                required
                type="date"
                name="purchaseDate"
                value={formData.purchaseDate}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500"
              />{" "}
            </label>{" "}
            <label className="text-sm text-slate-500 dark:text-slate-400">
              {" "}
              Note{" "}
              <input
                name="note"
                value={formData.note}
                onChange={handleChange}
                placeholder="Optional"
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-500"
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
