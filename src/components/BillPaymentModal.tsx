import { useEffect, useState } from "react";
import type { Bill } from "../db/db";
import { fetchCards } from "../services/backend.service";
import { updateBill } from "../services/backendSync";
import { useBackendResource } from "../services/backendHooks";
import { X } from "lucide-react";

interface Props {
  bill: Bill;
  onClose: () => void;
}

const PAYMENT_TYPES = [
  { value: "card", label: "Card" },
  { value: "bank", label: "Bank account" },
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "other", label: "Other" },
] as const;

export default function BillPaymentModal({ bill, onClose }: Readonly<Props>) {
  const accounts = useBackendResource(() => fetchCards(), []);
  const [paymentType, setPaymentType] = useState<NonNullable<Bill["paymentType"]>>(
    bill.paymentType ?? "card",
  );
  const [paymentAccountId, setPaymentAccountId] = useState(bill.paymentAccountId ?? "");
  const [paidDate, setPaidDate] = useState(
    bill.paidDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  );
  const [paymentReference, setPaymentReference] = useState(bill.paymentReference ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (paymentType === "cash" || paymentType === "other") setPaymentAccountId("");
  }, [paymentType]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!bill.id || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await updateBill(bill.id, {
        paid: true,
        paidDate,
        paymentType,
        paymentAccountId: paymentAccountId || undefined,
        paymentReference: paymentReference.trim() || undefined,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const needsAccount = paymentType === "card" || paymentType === "bank" || paymentType === "upi";
  const availableAccounts = (accounts ?? []).filter((account) =>
    paymentType === "card"
      ? account.type === "credit" || account.type === "debit"
      : account.type === "bank",
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-500"
          title="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Payment details
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{bill.name}</p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="bill-paid-date"
              className="mb-1 block text-sm text-slate-500 dark:text-slate-400"
            >
              Paid date
            </label>
            <input
              id="bill-paid-date"
              required
              type="date"
              value={paidDate}
              onChange={(event) => setPaidDate(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <div>
            <label
              htmlFor="bill-payment-type"
              className="mb-1 block text-sm text-slate-500 dark:text-slate-400"
            >
              Paid with
            </label>
            <select
              id="bill-payment-type"
              value={paymentType}
              onChange={(event) =>
                setPaymentType(event.target.value as NonNullable<Bill["paymentType"]>)
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              {PAYMENT_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {needsAccount && (
            <div>
              <label
                htmlFor="bill-payment-account"
                className="mb-1 block text-sm text-slate-500 dark:text-slate-400"
              >
                Account
              </label>
              <select
                id="bill-payment-account"
                required
                value={paymentAccountId}
                onChange={(event) => setPaymentAccountId(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">Select an account...</option>
                {availableAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label
              htmlFor="bill-payment-reference"
              className="mb-1 block text-sm text-slate-500 dark:text-slate-400"
            >
              Reference (optional)
            </label>
            <input
              id="bill-payment-reference"
              value={paymentReference}
              onChange={(event) => setPaymentReference(event.target.value)}
              placeholder="Transaction ID or note"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 dark:border-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (needsAccount && !paymentAccountId)}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Mark paid"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
