import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Card } from "../../db/db";
import { createBeneficiary, createTransfer } from "../../services/backendSync";
import { useBackendResource } from "../../services/backendHooks";
import { fetchBeneficiaries } from "../../services/backend.service";
import { showAlert } from "../../components/Confirm";
import CurrencySelect from "../CurrencySelect";
import { getDisplayCurrency } from "../../services/currency.service";

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
    destinationType: "internal" as "internal" | "external",
    externalName: "",
    externalBankName: "",
    externalAccountNumber: "",
    externalIfscCode: "",
    externalUpiId: "",
    amount: "",
    date: todayLocal(),
    note: "",
    currency: getDisplayCurrency(),
  });
  const beneficiaries = useBackendResource(() => fetchBeneficiaries(), []);
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [saveBeneficiary, setSaveBeneficiary] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        fromAccountId: "",
        toAccountId: "",
        destinationType: "internal",
        externalName: "",
        externalBankName: "",
        externalAccountNumber: "",
        externalIfscCode: "",
        externalUpiId: "",
        amount: "",
        date: todayLocal(),
        note: "",
        currency: getDisplayCurrency(),
      });
      setBeneficiaryId("");
      setSaveBeneficiary(false);
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
    const fromAccountId = formData.fromAccountId;
    const toAccountId = formData.toAccountId;
    const amount = Number.parseFloat(formData.amount || "0");
    if (!fromAccountId || (formData.destinationType === "internal" && !toAccountId)) {
      await showAlert("Please select a source and destination");
      return;
    }
    if (formData.destinationType === "internal" && fromAccountId === toAccountId) {
      await showAlert("Source and destination accounts must be different");
      return;
    }
    if (amount <= 0) {
      await showAlert("Please enter an amount greater than zero");
      return;
    }
    if (formData.destinationType === "external" && !formData.externalName.trim()) {
      await showAlert("Please enter the external recipient name");
      return;
    }
    const externalDetails =
      formData.destinationType === "external" && beneficiaryId
        ? beneficiaries?.find((beneficiary) => beneficiary.id === beneficiaryId)
        : undefined;
    const recipient = externalDetails ?? {
      name: formData.externalName.trim(),
      bankName: formData.externalBankName.trim() || undefined,
      accountNumber: formData.externalAccountNumber.trim() || undefined,
      ifscCode: formData.externalIfscCode.trim() || undefined,
      upiId: formData.externalUpiId.trim() || undefined,
    };
    await createTransfer({
      fromAccountId,
      ...(formData.destinationType === "internal" ? { toAccountId } : {}),
      destinationType: formData.destinationType,
      ...(formData.destinationType === "external"
        ? {
            externalName: recipient.name,
            externalBankName: recipient.bankName,
            externalAccountNumber: recipient.accountNumber,
            externalIfscCode: recipient.ifscCode,
            externalUpiId: recipient.upiId,
          }
        : {}),
      amount,
      date: formData.date,
      note: formData.note.trim() || undefined,
      currency: formData.currency,
    });
    if (formData.destinationType === "external" && saveBeneficiary && !externalDetails) {
      await createBeneficiary({
        name: recipient.name,
        bankName: recipient.bankName,
        accountNumber: recipient.accountNumber,
        ifscCode: recipient.ifscCode,
        upiId: recipient.upiId,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-2xl dark:bg-slate-900 dark:border-slate-800 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 pb-0">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Add Transfer</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="destinationType"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Destination
              </label>
              <select
                id="destinationType"
                name="destinationType"
                value={formData.destinationType}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="internal">My account</option>
                <option value="external">External recipient</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="fromAccountId"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                From account
              </label>
              <select
                id="fromAccountId"
                name="fromAccountId"
                value={formData.fromAccountId}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-slate-900 dark:bg-slate-100 dark:bg-slate-800 dark:border-slate-200 dark:border-slate-700 dark:text-slate-900 dark:text-slate-100"
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
              <label
                htmlFor="toAccountId"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                To account
              </label>
              {formData.destinationType === "internal" ? (
                <select
                  id="toAccountId"
                  name="toAccountId"
                  value={formData.toAccountId}
                  onChange={handleChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">Select account</option>
                  {cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.title}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  required
                  id="externalName"
                  name="externalName"
                  value={formData.externalName}
                  onChange={handleChange}
                  placeholder="Recipient name"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                />
              )}
            </div>
          </div>
          {formData.destinationType === "external" && (
            <div className="space-y-3">
              {beneficiaries && beneficiaries.length > 0 && (
                <select
                  value={beneficiaryId}
                  onChange={(event) => {
                    const beneficiary = beneficiaries.find(
                      (item) => item.id === event.target.value,
                    );
                    setBeneficiaryId(event.target.value);
                    if (beneficiary) {
                      setFormData((prev) => ({
                        ...prev,
                        externalName: beneficiary.name,
                        externalBankName: beneficiary.bankName ?? "",
                        externalAccountNumber: beneficiary.accountNumber ?? "",
                        externalIfscCode: beneficiary.ifscCode ?? "",
                        externalUpiId: beneficiary.upiId ?? "",
                      }));
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">Enter a new recipient</option>
                  {beneficiaries.map((beneficiary) => (
                    <option key={beneficiary.id} value={beneficiary.id}>
                      {beneficiary.name}
                      {beneficiary.bankName ? ` · ${beneficiary.bankName}` : ""}
                    </option>
                  ))}
                </select>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  name="externalBankName"
                  value={formData.externalBankName}
                  onChange={handleChange}
                  placeholder="Bank name (optional)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                />
                <input
                  name="externalAccountNumber"
                  value={formData.externalAccountNumber}
                  onChange={handleChange}
                  placeholder="Account number (optional)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                />
                <input
                  name="externalIfscCode"
                  value={formData.externalIfscCode}
                  onChange={handleChange}
                  placeholder="IFSC code (optional)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                />
                <input
                  name="externalUpiId"
                  value={formData.externalUpiId}
                  onChange={handleChange}
                  placeholder="UPI ID (optional)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              {!beneficiaryId && (
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={saveBeneficiary}
                    onChange={(event) => setSaveBeneficiary(event.target.checked)}
                  />
                  Save this recipient for future transfers
                </label>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="amount"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Amount
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={handleChange}
                  className="w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-slate-900 dark:bg-slate-100 dark:bg-slate-800 dark:border-slate-200 dark:border-slate-700 dark:text-slate-900 dark:text-slate-100"
                />
                <CurrencySelect
                  value={formData.currency}
                  onChange={(currency) => setFormData((prev) => ({ ...prev, currency }))}
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="date"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Date
              </label>
              <input
                id="date"
                name="date"
                type="date"
                value={formData.date}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-slate-900 dark:bg-slate-100 dark:bg-slate-800 dark:border-slate-200 dark:border-slate-700 dark:text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="note"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Note
            </label>
            <textarea
              id="note"
              name="note"
              rows={2}
              value={formData.note}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg bg-white border border-slate-300 px-3 py-2 text-slate-900 dark:bg-slate-100 dark:bg-slate-800 dark:border-slate-200 dark:border-slate-700 dark:text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:bg-slate-800"
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
