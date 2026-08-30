import { useEffect, useState } from "react";
import type { InsurancePolicy, InsuranceType, PremiumFrequency } from "../../db/db";
import { createInsurancePolicy, updateInsurancePolicy } from "../../services/backendSync";
import showConfirm from "../../components/Confirm";
import { X } from "lucide-react";
interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialPolicy?: InsurancePolicy;
}
const TYPE_OPTIONS: { value: InsuranceType; label: string }[] = [
  { value: "health", label: "Health" },
  { value: "life", label: "Life" },
  { value: "term", label: "Term" },
  { value: "vehicle", label: "Vehicle" },
  { value: "home", label: "Home" },
  { value: "other", label: "Other" },
];
const FREQUENCY_OPTIONS: { value: PremiumFrequency; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half-yearly", label: "Half-yearly" },
  { value: "yearly", label: "Yearly" },
];
function today() {
  return new Date().toISOString().slice(0, 10);
}
export default function AddInsuranceModal({ isOpen, onClose, initialPolicy }: Props) {
  const [formData, setFormData] = useState({
    policyName: "",
    type: "health" as InsuranceType,
    provider: "",
    policyNumber: "",
    sumAssured: "",
    premiumAmount: "",
    premiumFrequency: "yearly" as PremiumFrequency,
    startDate: today(),
    endDate: "",
    note: "",
  });
  useEffect(() => {
    if (initialPolicy) {
      setFormData({
        policyName: initialPolicy.policyName,
        type: initialPolicy.type,
        provider: initialPolicy.provider,
        policyNumber: initialPolicy.policyNumber ?? "",
        sumAssured: initialPolicy.sumAssured.toString(),
        premiumAmount: initialPolicy.premiumAmount.toString(),
        premiumFrequency: initialPolicy.premiumFrequency,
        startDate: initialPolicy.startDate,
        endDate: initialPolicy.endDate ?? "",
        note: initialPolicy.note ?? "",
      });
    } else if (isOpen) {
      setFormData({
        policyName: "",
        type: "health",
        provider: "",
        policyNumber: "",
        sumAssured: "",
        premiumAmount: "",
        premiumFrequency: "yearly",
        startDate: today(),
        endDate: "",
        note: "",
      });
    }
  }, [initialPolicy, isOpen]);
  if (!isOpen) return null;
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    const payload: InsurancePolicy = {
      policyName: formData.policyName.trim(),
      type: formData.type,
      provider: formData.provider.trim(),
      policyNumber: formData.policyNumber.trim() || undefined,
      sumAssured: Number.parseFloat(formData.sumAssured || "0"),
      premiumAmount: Number.parseFloat(formData.premiumAmount || "0"),
      premiumFrequency: formData.premiumFrequency,
      startDate: formData.startDate,
      endDate: formData.endDate || undefined,
      note: formData.note.trim() || undefined,
      createdAt: initialPolicy?.createdAt ?? new Date().toISOString(),
      premiumPayments: initialPolicy?.premiumPayments ?? [],
    };
    if (initialPolicy?.id) {
      const ok = await showConfirm(`Save changes to "${payload.policyName}"?`, {
        title: "Confirm update",
        confirmText: "Save changes",
      });
      if (!ok) return;
      await updateInsurancePolicy(initialPolicy.id, payload);
    } else {
      await createInsurancePolicy(payload);
    }
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      {" "}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {" "}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          {" "}
          <X className="w-5 h-5" />{" "}
        </button>{" "}
        <div className="p-6 border-b border-slate-800">
          {" "}
          <h2 className="text-xl font-bold bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
            {" "}
            {initialPolicy ? "Edit Insurance Policy" : "Add Insurance Policy"}{" "}
          </h2>{" "}
        </div>{" "}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {" "}
          <div>
            {" "}
            <label className="block text-sm font-medium text-slate-400 mb-1">
              {" "}
              Policy Name{" "}
            </label>{" "}
            <input
              required
              type="text"
              name="policyName"
              placeholder="e.g. Family Health Cover"
              value={formData.policyName}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
            />{" "}
          </div>{" "}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {" "}
            <div>
              {" "}
              <label className="block text-sm font-medium text-slate-400 mb-1"> Type </label>{" "}
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
              >
                {" "}
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {" "}
                    {t.label}{" "}
                  </option>
                ))}{" "}
              </select>{" "}
            </div>{" "}
            <div>
              {" "}
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {" "}
                Provider{" "}
              </label>{" "}
              <input
                required
                type="text"
                name="provider"
                value={formData.provider}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
              />{" "}
            </div>{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="block text-sm font-medium text-slate-400 mb-1">
              {" "}
              Policy Number (optional){" "}
            </label>{" "}
            <input
              type="text"
              name="policyNumber"
              value={formData.policyNumber}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
            />{" "}
          </div>{" "}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {" "}
            <div>
              {" "}
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {" "}
                Sum Assured{" "}
              </label>{" "}
              <input
                required
                type="number"
                min="0"
                name="sumAssured"
                value={formData.sumAssured}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
              />{" "}
            </div>{" "}
            <div>
              {" "}
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {" "}
                Premium Amount{" "}
              </label>{" "}
              <input
                required
                type="number"
                min="0"
                name="premiumAmount"
                value={formData.premiumAmount}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
              />{" "}
            </div>{" "}
          </div>{" "}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {" "}
            <div>
              {" "}
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {" "}
                Premium Frequency{" "}
              </label>{" "}
              <select
                name="premiumFrequency"
                value={formData.premiumFrequency}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
              >
                {" "}
                {FREQUENCY_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {" "}
                    {f.label}{" "}
                  </option>
                ))}{" "}
              </select>{" "}
            </div>{" "}
            <div>
              {" "}
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {" "}
                Start Date{" "}
              </label>{" "}
              <input
                required
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
              />{" "}
            </div>{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="block text-sm font-medium text-slate-400 mb-1">
              {" "}
              End Date (optional){" "}
            </label>{" "}
            <input
              type="date"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
            />{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="block text-sm font-medium text-slate-400 mb-1"> Notes </label>{" "}
            <textarea
              name="note"
              value={formData.note}
              onChange={handleChange}
              rows={2}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
            />{" "}
          </div>{" "}
          <div className="pt-2">
            {" "}
            <button
              type="submit"
              className="w-full bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {" "}
              {initialPolicy ? "Update Policy" : "Save Policy"}{" "}
            </button>{" "}
          </div>{" "}
        </form>{" "}
      </div>{" "}
    </div>
  );
}
