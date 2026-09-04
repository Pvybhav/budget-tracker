import { useState } from "react";
import { createLoan, updateLoan } from "../../services/backendSync";
import { X, Info } from "lucide-react";
import { calcMonthlyEmi } from "../../services/card.service";
import { showAlert, showConfirm } from "../../components/Confirm";
import { type Loan } from "../../db/db";
import CurrencySelect from "../CurrencySelect";
import { formatMoney, getDisplayCurrency } from "../../services/currency.service";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialLoan?: Loan;
}

const INTEREST_PRESETS = [
  { label: "0% (No interest)", value: 0 },
  { label: "5% p.a.", value: 5 },
  { label: "8% p.a.", value: 8 },
  { label: "10% p.a.", value: 10 },
  { label: "12% p.a.", value: 12 },
  { label: "14% p.a.", value: 14 },
  { label: "16% p.a.", value: 16 },
  { label: "Custom", value: -1 },
];

export default function AddLoanModal({ isOpen, onClose, initialLoan }: Props) {
  const [formData, setFormData] = useState(() => {
    if (initialLoan) {
      const preset = INTEREST_PRESETS.find(
        (option) => option.value >= 0 && option.value === initialLoan.annualInterestRate,
      );
      return {
        lender: initialLoan.lender,
        principal: initialLoan.principal.toString(),
        interestPreset: preset?.value ?? -1,
        customInterest: preset ? "" : initialLoan.annualInterestRate.toString(),
        termMonths: initialLoan.termMonths,
        startDate: initialLoan.startDate,
        note: initialLoan.note ?? "",
        currency: initialLoan.currency ?? getDisplayCurrency(),
      };
    }

    return {
      lender: "",
      principal: "",
      interestPreset: 10,
      customInterest: "",
      termMonths: 12,
      startDate: new Date().toISOString().slice(0, 10),
      note: "",
      currency: getDisplayCurrency(),
    };
  });

  if (!isOpen) return null;

  const principal = parseFloat(formData.principal) || 0;
  const interestRate =
    formData.interestPreset === -1
      ? parseFloat(formData.customInterest) || 0
      : formData.interestPreset;
  const termMonths = formData.termMonths;
  const monthlyEmi =
    principal > 0 && termMonths > 0 ? calcMonthlyEmi(principal, interestRate, termMonths) : 0;
  const totalCost = monthlyEmi * termMonths;
  const totalInterest = totalCost - principal;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (name === "interestPreset") {
      setFormData({ ...formData, interestPreset: Number(value) });
      return;
    }

    if (type === "number") {
      setFormData({
        ...formData,
        [name]: name === "termMonths" ? parseInt(value) : value,
      });
      return;
    }

    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!formData.lender.trim()) {
      await showAlert("Please add a lender name.");
      return;
    }
    if (principal <= 0) {
      await showAlert("Please enter a loan principal greater than zero.");
      return;
    }
    if (termMonths <= 0) {
      await showAlert("Please enter a valid loan term in months.");
      return;
    }

    const payload = {
      lender: formData.lender.trim(),
      principal,
      annualInterestRate: interestRate,
      termMonths,
      startDate: formData.startDate,
      note: formData.note.trim() || undefined,
      createdAt: initialLoan?.createdAt ?? new Date().toISOString(),
      currency: formData.currency,
    };

    if (initialLoan?.id) {
      const ok = await showConfirm(`Save changes to the loan from "${payload.lender}"?`, {
        title: "Confirm update",
        confirmText: "Save changes",
      });
      if (!ok) return;
      await updateLoan(initialLoan.id, payload);
    } else {
      await createLoan(payload);
    }

    setFormData({
      lender: "",
      principal: "",
      interestPreset: 10,
      customInterest: "",
      termMonths: 12,
      startDate: new Date().toISOString().slice(0, 10),
      note: "",
      currency: getDisplayCurrency(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-2xl dark:bg-slate-900 dark:border-slate-800 w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            {initialLoan ? "Edit Personal Loan" : "Add Personal Loan"}
          </h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400 text-sm">
            Track a loan with EMI calculations and repayments in one place.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                Lender / Source <span className="text-red-400">*</span>
              </label>
              <input
                required
                name="lender"
                value={formData.lender}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                placeholder="e.g. Bank, Friend, Family"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                Start Date
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                Principal Amount <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="principal"
                  value={formData.principal}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                  placeholder="₹0.00"
                />
                <CurrencySelect
                  value={formData.currency}
                  onChange={(currency) => setFormData({ ...formData, currency })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                Loan Term (months) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="240"
                name="termMonths"
                value={formData.termMonths}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                Interest Rate
              </label>
              <select
                name="interestPreset"
                value={formData.interestPreset}
                onChange={handleChange}
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                {INTEREST_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
              {formData.interestPreset === -1 && (
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  name="customInterest"
                  value={formData.customInterest}
                  onChange={handleChange}
                  placeholder="e.g. 11.5"
                  className="mt-2 w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                Notes
              </label>
              <input
                type="text"
                name="note"
                value={formData.note}
                onChange={handleChange}
                placeholder="Optional description"
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 p-4 space-y-3 dark:bg-slate-900/80">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500 font-semibold">
              <Info className="w-4 h-4 text-cyan-400" /> Loan summary
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Monthly EMI</span>
                <span className="text-slate-900 dark:text-slate-100 font-semibold">
                  {formatMoney(monthlyEmi, formData.currency)}
                </span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Total Cost</span>
                <span className="text-slate-900 dark:text-slate-100 font-semibold">
                  {formatMoney(totalCost, formData.currency)}
                </span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Total Interest</span>
                <span className="text-slate-900 dark:text-slate-100 font-semibold">
                  {formatMoney(totalInterest, formData.currency)}
                </span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Repayment months</span>
                <span className="text-slate-900 dark:text-slate-100 font-semibold">
                  {termMonths}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-3 rounded-lg font-medium transition-colors"
            >
              {initialLoan ? "Update Loan" : "Save Loan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
