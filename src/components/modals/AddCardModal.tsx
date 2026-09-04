import React, { useState, useEffect } from "react";
import { type AccountType, type Card, type CardIconKey } from "../../db/db";
import { createCard, updateCard } from "../../services/backendSync";
import { useBackendResource } from "../../services/backendHooks";
import { fetchCards } from "../../services/backend.service";
import { X } from "lucide-react";
import CurrencySelect from "../CurrencySelect";
import { formatMoney, getDisplayCurrency } from "../../services/currency.service";
import { CARD_ICON_OPTIONS } from "../../utils/typeIcons";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialCard?: Card;
}

export default function AddCardModal({ isOpen, onClose, initialCard }: Props) {
  const allCards = useBackendResource(() => fetchCards(), []);
  const [formData, setFormData] = useState({
    title: "",
    type: "credit" as AccountType,
    icon: "credit-card" as CardIconKey,
    billingDate: "",
    paymentDate: "",
    totalLimit: "",
    amc: "0",
    waiveOffLimit: "0",
    linkedCardIds: [] as string[],
    isLinkedCard: false,
    masterCardId: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    currency: getDisplayCurrency(),
  });

  useEffect(() => {
    if (initialCard) {
      setFormData({
        title: initialCard.title,
        type: initialCard.type ?? "credit",
        icon: initialCard.icon ?? "credit-card",
        billingDate: initialCard.billingDate?.toString() ?? "",
        paymentDate: initialCard.paymentDate?.toString() ?? "",
        totalLimit: initialCard.totalLimit.toString(),
        amc: initialCard.amc?.toString() ?? "0",
        waiveOffLimit: initialCard.waiveOffLimit?.toString() ?? "0",
        linkedCardIds: initialCard.linkedCardIds ?? [],
        isLinkedCard: (initialCard.linkedCardIds?.length ?? 0) > 0,
        masterCardId: initialCard.linkedCardIds?.[0]?.toString() ?? "",
        bankName: initialCard.bankName ?? "",
        accountNumber: initialCard.accountNumber ?? "",
        ifscCode: initialCard.ifscCode ?? "",
        currency: initialCard.currency ?? getDisplayCurrency(),
      });
    } else {
      setFormData({
        title: "",
        type: "credit",
        icon: "credit-card",
        billingDate: "",
        paymentDate: "",
        totalLimit: "",
        amc: "0",
        waiveOffLimit: "0",
        linkedCardIds: [],
        isLinkedCard: false,
        masterCardId: "",
        bankName: "",
        accountNumber: "",
        ifscCode: "",
        currency: getDisplayCurrency(),
      });
    }
  }, [initialCard, isOpen]);

  if (!isOpen) return null;

  const selectedMasterCard = (allCards ?? []).find(
    (card) => card.id?.toString() === formData.masterCardId,
  );
  const shouldUseLinkedValues = formData.isLinkedCard && !!selectedMasterCard;
  const sharedLimitValue = shouldUseLinkedValues
    ? (selectedMasterCard?.totalLimit?.toString() ?? formData.totalLimit)
    : formData.totalLimit;
  const sharedBillingDate = shouldUseLinkedValues
    ? (selectedMasterCard?.billingDate?.toString() ?? formData.billingDate)
    : formData.billingDate;
  const sharedPaymentDate = shouldUseLinkedValues
    ? (selectedMasterCard?.paymentDate?.toString() ?? formData.paymentDate)
    : formData.paymentDate;
  const sharedAmc = shouldUseLinkedValues
    ? (selectedMasterCard?.amc?.toString() ?? formData.amc)
    : formData.amc;
  const sharedWaiveOffLimit = shouldUseLinkedValues
    ? (selectedMasterCard?.waiveOffLimit?.toString() ?? formData.waiveOffLimit)
    : formData.waiveOffLimit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isCreditAccount = formData.type === "credit";
    const payload = {
      title: formData.title,
      type: formData.type,
      icon: formData.icon,
      billingDate: isCreditAccount ? parseInt(sharedBillingDate || "0", 10) : 0,
      paymentDate: isCreditAccount ? parseInt(sharedPaymentDate || "0", 10) : 0,
      totalLimit: parseFloat(sharedLimitValue || "0"),
      amc: isCreditAccount ? parseFloat(sharedAmc || "0") : 0,
      waiveOffLimit: isCreditAccount ? parseFloat(sharedWaiveOffLimit || "0") : 0,
      linkedCardIds: formData.type === "credit" ? formData.linkedCardIds : [],
      bankName: formData.type === "bank" ? formData.bankName.trim() || undefined : undefined,
      accountNumber:
        formData.type === "bank" ? formData.accountNumber.trim() || undefined : undefined,
      ifscCode: formData.type === "bank" ? formData.ifscCode.trim() || undefined : undefined,
      currency: formData.currency,
    };

    if (initialCard) {
      await updateCard(initialCard.id!, payload);
    } else {
      await createCard(payload);
    }
    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setFormData({
        ...formData,
        [name]: (e.target as HTMLInputElement).checked,
      });
      return;
    }
    setFormData({ ...formData, [name]: value });
  };

  const handleMasterCardChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const masterCardId = e.target.value;
    setFormData((prev) => ({
      ...prev,
      masterCardId,
      linkedCardIds: masterCardId
        ? prev.linkedCardIds.filter((id) => id.toString() !== masterCardId)
        : prev.linkedCardIds,
    }));
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
          <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            {initialCard ? "Edit Card" : "Add New Card"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              Account Name
            </label>
            <input
              required
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              Account icon
            </label>
            <select
              name="icon"
              value={formData.icon}
              onChange={handleChange}
              className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-blue-500"
            >
              {CARD_ICON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              Account Type
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="credit">Credit Card</option>
              <option value="debit">Debit Card</option>
              <option value="meal">Meal Card</option>
              <option value="bank">Bank Account</option>
              <option value="cash">Cash</option>
              <option value="wallet">UPI Wallet</option>
              <option value="gift">Gift Card</option>
              <option value="other">Other</option>
            </select>
          </div>
          {formData.type === "bank" && (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-950/70">
              <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Bank account details
              </div>
              <input
                type="text"
                name="bankName"
                value={formData.bankName}
                onChange={handleChange}
                placeholder="Bank name"
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
              />
              <input
                type="text"
                name="accountNumber"
                value={formData.accountNumber}
                onChange={handleChange}
                placeholder="Account number"
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
              />
              <input
                type="text"
                name="ifscCode"
                value={formData.ifscCode}
                onChange={handleChange}
                placeholder="IFSC code"
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
              />
            </div>
          )}
          {formData.type === "credit" ? (
            <>
              <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-950/70 px-3 py-3 text-sm text-slate-700 dark:text-slate-300">
                <span>Linked card</span>
                <input
                  type="checkbox"
                  name="isLinkedCard"
                  checked={formData.isLinkedCard}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 accent-emerald-500"
                />
              </label>
              {formData.isLinkedCard ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-950/70 p-3 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Select master credit card <span className="text-red-400">*</span>
                    </label>
                    <select
                      required={formData.isLinkedCard}
                      value={formData.masterCardId}
                      onChange={handleMasterCardChange}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">Choose a card...</option>
                      {(allCards ?? [])
                        .filter(
                          (card) =>
                            card.type === "credit" &&
                            card.id !== initialCard?.id &&
                            (card.linkedCardIds?.length ?? 0) === 0,
                        )
                        .map((card) => (
                          <option key={card.id} value={card.id}>
                            {card.title}
                          </option>
                        ))}
                    </select>
                  </div>
                  {selectedMasterCard && (
                    <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-50 dark:bg-slate-900/70 px-3 py-2">
                        <span className="text-slate-500 dark:text-slate-400">Billing Date</span>
                        <span>{selectedMasterCard.billingDate ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-50 dark:bg-slate-900/70 px-3 py-2">
                        <span className="text-slate-500 dark:text-slate-400">Payment Date</span>
                        <span>{selectedMasterCard.paymentDate ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-50 dark:bg-slate-900/70 px-3 py-2">
                        <span className="text-slate-500 dark:text-slate-400">AMC</span>
                        <span>
                          {formatMoney(selectedMasterCard.amc ?? 0, selectedMasterCard.currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-50 dark:bg-slate-900/70 px-3 py-2">
                        <span className="text-slate-500 dark:text-slate-400">
                          Spent to Waive AMC
                        </span>
                        <span>
                          {formatMoney(
                            selectedMasterCard.waiveOffLimit ?? 0,
                            selectedMasterCard.currency,
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-50 dark:bg-slate-900/70 px-3 py-2">
                        <span className="text-slate-500 dark:text-slate-400">Total Limit</span>
                        <>
                          {formatMoney(
                            selectedMasterCard.totalLimit ?? 0,
                            selectedMasterCard.currency,
                          )}
                        </>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Billing Date (1-31)
                    </label>
                    <input
                      required
                      type="number"
                      min="1"
                      max="31"
                      name="billingDate"
                      value={sharedBillingDate}
                      onChange={handleChange}
                      className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Payment Date (1-31)
                    </label>
                    <input
                      required
                      type="number"
                      min="1"
                      max="31"
                      name="paymentDate"
                      value={sharedPaymentDate}
                      onChange={handleChange}
                      className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
              {!formData.isLinkedCard && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                      AMC
                    </label>
                    <input
                      required
                      type="number"
                      name="amc"
                      value={sharedAmc}
                      onChange={handleChange}
                      className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Spent to Waive AMC
                    </label>
                    <input
                      required
                      type="number"
                      name="waiveOffLimit"
                      value={sharedWaiveOffLimit}
                      onChange={handleChange}
                      className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-950/70 p-3 text-sm text-slate-500 dark:text-slate-400">
              This account type uses a balance-based view, so billing dates and AMC settings are not
              required.
            </div>
          )}
          {!formData.isLinkedCard && (
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                {formData.type === "credit" ? "Total Limit" : "Starting Balance"}
              </label>
              <div className="flex gap-2">
                <input
                  required
                  type="number"
                  name="totalLimit"
                  value={sharedLimitValue}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
                <CurrencySelect
                  value={formData.currency}
                  onChange={(currency) => setFormData({ ...formData, currency })}
                  className="bg-white border border-slate-300 rounded-lg px-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 text-sm"
                />
              </div>
            </div>
          )}
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
