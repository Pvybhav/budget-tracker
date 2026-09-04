import { useMemo, useState } from "react";
import type { InsurancePaymentType, InsurancePolicy } from "../db/db";
import { useBackendResource } from "../services/backendHooks";
import { fetchCards, fetchInsurancePolicies } from "../services/backend.service";
import { deleteInsurancePolicy, updateInsurancePolicy } from "../services/backendSync";
import { getInsurancePolicySummary } from "../services/insurance.service";
import AddInsuranceModal from "../components/modals/AddInsuranceModal";
import showConfirm from "../components/Confirm";
import { Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
import { INSURANCE_TYPE_ICONS } from "../utils/typeIcons";
import PaginationControls from "../components/PaginationControls";
import { formatDateOnly } from "../utils/date";
const TYPE_LABELS: Record<string, string> = {
  health: "Health",
  life: "Life",
  term: "Term",
  vehicle: "Vehicle",
  home: "Home",
  other: "Other",
};
const STATUS_STYLES: Record<string, string> = {
  due: "border-red-500/30 bg-red-500/10 text-red-300",
  upcoming: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  expired:
    "border-slate-400 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
};
const PAYMENT_TYPE_OPTIONS: { value: InsurancePaymentType; label: string }[] = [
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank", label: "Bank transfer" },
  { value: "other", label: "Other" },
];
export default function ManageInsurancePage() {
  const displayCurrency = useDisplayCurrency();
  const policies = useBackendResource(() => fetchInsurancePolicies(), []);
  const cards = useBackendResource(() => fetchCards(), []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [policyToEdit, setPolicyToEdit] = useState<InsurancePolicy | undefined>();
  const [policyToPay, setPolicyToPay] = useState<InsurancePolicy | undefined>();
  const [paymentType, setPaymentType] = useState<InsurancePaymentType>("card");
  const [paymentSource, setPaymentSource] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const filteredPolicies = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (policies ?? []).filter(
      (policy) =>
        !query ||
        policy.policyName.toLowerCase().includes(query) ||
        policy.provider.toLowerCase().includes(query) ||
        policy.policyNumber?.toLowerCase().includes(query),
    );
  }, [policies, search]);
  const visiblePolicies = filteredPolicies.slice((page - 1) * pageSize, page * pageSize);
  const openAddModal = () => {
    setPolicyToEdit(undefined);
    setIsModalOpen(true);
  };
  const openEditModal = (policy: InsurancePolicy) => {
    setPolicyToEdit(policy);
    setIsModalOpen(true);
  };
  const openPaymentModal = (policy: InsurancePolicy) => {
    setPolicyToPay(policy);
    setPaymentType("card");
    setPaymentSource("");
  };
  const handleDelete = async (policy: InsurancePolicy) => {
    const ok = await showConfirm(`Delete "${policy.policyName}"? This cannot be undone.`, {
      title: "Delete policy",
      confirmText: "Delete",
    });
    if (ok) await deleteInsurancePolicy(policy.id!);
  };
  const recordPremiumPayment = async () => {
    if (!policyToPay?.id || ((paymentType === "card" || paymentType === "upi") && !paymentSource))
      return;
    const payments = [
      ...(policyToPay.premiumPayments ?? []),
      {
        date: new Date().toISOString().slice(0, 10),
        amount: policyToPay.premiumAmount,
        paymentType,
        ...(paymentType === "card" || paymentType === "upi" ? { paymentSource } : {}),
      },
    ];
    await updateInsurancePolicy(policyToPay.id, { premiumPayments: payments });
    setPolicyToPay(undefined);
  };
  return (
    <div className="space-y-6">
      {" "}
      <div className="flex items-center justify-between">
        {" "}
        <div>
          {" "}
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            {" "}
            Manage Insurance{" "}
          </h1>{" "}
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {" "}
            Track health, life, and vehicle policies with premium due dates.{" "}
          </p>{" "}
        </div>{" "}
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {" "}
          <Plus className="w-4 h-4" /> Add Policy{" "}
        </button>{" "}
      </div>{" "}
      <input
        type="search"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        placeholder="Search policies, providers, or policy numbers"
        aria-label="Search insurance policies"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />{" "}
      {!policies || policies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 p-8 text-center text-sm text-slate-600 dark:text-slate-400">
          {" "}
          No insurance policies added yet.{" "}
        </div>
      ) : (
        <div className="space-y-4">
          {" "}
          {filteredPolicies.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
              No insurance policies match your search.
            </div>
          ) : (
            visiblePolicies.map((policy) => {
              const summary = getInsurancePolicySummary(policy);
              return (
                <div
                  key={policy.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5"
                >
                  {" "}
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    {" "}
                    <div className="space-y-1">
                      {" "}
                      <div className="flex items-center gap-2">
                        {" "}
                        {(() => {
                          const Icon = INSURANCE_TYPE_ICONS[policy.type] ?? ShieldCheck;
                          return <Icon className="h-4 w-4 text-sky-400" aria-hidden="true" />;
                        })()}{" "}
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                          {" "}
                          {policy.policyName}{" "}
                        </h3>{" "}
                        <span className="rounded-full border border-slate-300 dark:border-slate-700 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-400">
                          {" "}
                          {TYPE_LABELS[policy.type]}{" "}
                        </span>{" "}
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${STATUS_STYLES[summary.status]}`}
                        >
                          {" "}
                          {summary.status}{" "}
                        </span>{" "}
                      </div>{" "}
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {" "}
                        {policy.provider} {policy.policyNumber ? ` · #${policy.policyNumber}` : ""}{" "}
                        · Sum assured{" "}
                        {formatMoney(
                          convertCurrency(policy.sumAssured, policy.currency, displayCurrency),
                          displayCurrency,
                        )}{" "}
                      </div>{" "}
                    </div>{" "}
                    <div className="flex items-center gap-2">
                      {" "}
                      <button
                        onClick={() => openPaymentModal(policy)}
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white"
                      >
                        {" "}
                        Record Premium Paid{" "}
                      </button>{" "}
                      <button
                        onClick={() => openEditModal(policy)}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        title="Edit policy"
                      >
                        {" "}
                        <Pencil className="h-4 w-4" />{" "}
                      </button>{" "}
                      <button
                        onClick={() => handleDelete(policy)}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                        title="Delete policy"
                      >
                        {" "}
                        <Trash2 className="h-4 w-4" />{" "}
                      </button>{" "}
                    </div>{" "}
                  </div>{" "}
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {" "}
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3">
                      {" "}
                      <div className="text-sm text-slate-600 dark:text-slate-400">Premium</div>{" "}
                      <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {" "}
                        {formatMoney(
                          convertCurrency(policy.premiumAmount, policy.currency, displayCurrency),
                          displayCurrency,
                        )}{" "}
                        / {policy.premiumFrequency}{" "}
                      </div>{" "}
                    </div>{" "}
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3">
                      {" "}
                      <div className="text-sm text-slate-600 dark:text-slate-400">Next Due</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {" "}
                        {formatDateOnly(summary.nextDueDate)}{" "}
                      </div>{" "}
                    </div>{" "}
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3">
                      {" "}
                      <div className="text-sm text-slate-600 dark:text-slate-400">Total Paid</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {" "}
                        {formatMoney(
                          convertCurrency(summary.totalPaid, policy.currency, displayCurrency),
                          displayCurrency,
                        )}{" "}
                      </div>{" "}
                    </div>{" "}
                  </div>{" "}
                  {policy.note && (
                    <div className="mt-3 text-sm text-slate-700 dark:text-slate-400">
                      {" "}
                      {policy.note}{" "}
                    </div>
                  )}{" "}
                  {(policy.premiumPayments?.length ?? 0) > 0 && (
                    <details className="mt-4 rounded-lg border border-slate-200 dark:border-slate-800">
                      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        Premium payment history ({policy.premiumPayments?.length})
                      </summary>
                      <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {[...(policy.premiumPayments ?? [])]
                          .sort((left, right) => right.date.localeCompare(left.date))
                          .map((payment) => {
                            const account = payment.paymentSource
                              ? cards?.find((card) => card.id === payment.paymentSource)?.title
                              : undefined;
                            return (
                              <div
                                key={payment.id ?? `${payment.date}-${payment.amount}`}
                                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                              >
                                <span className="text-slate-600 dark:text-slate-400">
                                  {payment.date}
                                </span>
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                  {formatMoney(
                                    convertCurrency(
                                      payment.amount,
                                      policy.currency,
                                      displayCurrency,
                                    ),
                                    displayCurrency,
                                  )}
                                </span>
                                <span className="capitalize text-slate-500">
                                  {payment.paymentType ?? "other"}
                                  {account ? ` · ${account}` : ""}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </details>
                  )}{" "}
                </div>
              );
            })
          )}{" "}
        </div>
      )}{" "}
      <PaginationControls
        page={page}
        totalItems={filteredPolicies.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />
      <AddInsuranceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialPolicy={policyToEdit}
      />{" "}
      {policyToPay && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl dark:bg-slate-900 dark:border-slate-800 w-full max-w-md shadow-2xl relative p-6">
            <button
              onClick={() => setPolicyToPay(undefined)}
              className="absolute top-4 right-4 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white"
              title="Close"
            >
              ×
            </button>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Record premium payment
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {policyToPay.policyName} ·{" "}
              {formatMoney(
                convertCurrency(policyToPay.premiumAmount, policyToPay.currency, displayCurrency),
                displayCurrency,
              )}
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="insurance-payment-type"
                  className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1"
                >
                  Paid with
                </label>
                <select
                  id="insurance-payment-type"
                  value={paymentType}
                  onChange={(event) => {
                    setPaymentType(event.target.value as InsurancePaymentType);
                    setPaymentSource("");
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-sky-500"
                >
                  {PAYMENT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {(paymentType === "card" || paymentType === "upi") && (
                <div>
                  <label
                    htmlFor="insurance-payment-source"
                    className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1"
                  >
                    {paymentType === "upi" ? "Linked bank account" : "Which card?"}
                  </label>
                  <select
                    id="insurance-payment-source"
                    required
                    value={paymentSource}
                    onChange={(event) => setPaymentSource(event.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-4 py-2 text-slate-900 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    <option value="">
                      {paymentType === "upi" ? "Select a bank account..." : "Select a card..."}
                    </option>
                    {cards
                      ?.filter((card) => paymentType !== "upi" || card.type === "bank")
                      .map((card) => (
                        <option key={card.id} value={card.id}>
                          {card.title}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setPolicyToPay(undefined)}
                  className="border border-slate-300 dark:border-slate-700 px-4 py-2 rounded-lg font-medium text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={recordPremiumPayment}
                  disabled={(paymentType === "card" || paymentType === "upi") && !paymentSource}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium"
                >
                  Record payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}{" "}
    </div>
  );
}
