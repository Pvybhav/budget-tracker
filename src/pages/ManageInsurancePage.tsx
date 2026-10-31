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
import { todayDateInput } from "../utils/date";
import { formatDateOnly } from "../utils/date";
import Tooltip from "../components/Tooltip";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
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
  const pageSize = 50;
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
  const policySummaries = useMemo(
    () =>
      (policies ?? []).map((policy) => ({
        policy,
        summary: getInsurancePolicySummary(policy),
      })),
    [policies],
  );
  const totalCoverage = policySummaries.reduce(
    (sum, item) =>
      sum + convertCurrency(item.policy.sumAssured, item.policy.currency, displayCurrency),
    0,
  );
  const annualPremium = policySummaries.reduce((sum, item) => {
    const premium = convertCurrency(
      item.policy.premiumAmount,
      item.policy.currency,
      displayCurrency,
    );
    const multiplier =
      item.policy.premiumFrequency === "monthly"
        ? 12
        : item.policy.premiumFrequency === "quarterly"
          ? 4
          : item.policy.premiumFrequency === "half-yearly"
            ? 2
            : 1;
    return sum + premium * multiplier;
  }, 0);
  const duePolicies = policySummaries.filter(
    ({ summary }) => summary.status === "due" || summary.status === "upcoming",
  ).length;
  const typeData = Object.entries(TYPE_LABELS)
    .map(([type, label]) => ({
      name: label,
      value: policySummaries.filter(({ policy }) => policy.type === type).length,
    }))
    .filter((item) => item.value > 0);
  const premiumData = policySummaries.slice(0, 8).map(({ policy }) => ({
    name: policy.policyName.length > 14 ? `${policy.policyName.slice(0, 14)}…` : policy.policyName,
    premium: convertCurrency(policy.premiumAmount, policy.currency, displayCurrency),
    coverage: convertCurrency(policy.sumAssured, policy.currency, displayCurrency),
  }));
  const chartColors = ["#38bdf8", "#818cf8", "#34d399", "#f59e0b", "#f472b6", "#a78bfa"];
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
        date: todayDateInput(),
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
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-xl dark:border-slate-800 md:p-8">
        <div className="absolute -right-16 -top-20 h-56 w-56 animate-pulse rounded-full bg-sky-400/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">
              Protection overview
            </p>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Insurance portfolio</h1>
            <p className="mt-2 text-sm text-slate-300">
              Stay ahead of renewals and understand the protection you have in place.
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-sky-50"
          >
            <Plus className="w-4 h-4" /> Add Policy
          </button>
        </div>
      </div>
      {policies && policies.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [
                "Active policies",
                policies.length,
                "Across your portfolio",
                "text-sky-500 bg-sky-500/10",
              ],
              [
                "Total coverage",
                formatMoney(totalCoverage, displayCurrency),
                "Sum assured",
                "text-indigo-500 bg-indigo-500/10",
              ],
              [
                "Annual premium",
                formatMoney(annualPremium, displayCurrency),
                "Estimated yearly cost",
                "text-emerald-500 bg-emerald-500/10",
              ],
              [
                "Upcoming attention",
                duePolicies,
                "Due or upcoming",
                "text-amber-500 bg-amber-500/10",
              ],
            ].map(([label, value, detail, color]) => (
              <div
                key={label}
                className="animate-[fade-in-up_0.5s_ease-out_both] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {label}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {value}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
                  </div>
                  <span className={`rounded-xl p-2.5 ${color}`}>
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">Coverage mix</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Policies by protection type
                </p>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={82}
                      paddingAngle={4}
                      animationBegin={150}
                      animationDuration={900}
                    >
                      {typeData.map((item, index) => (
                        <Cell key={item.name} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                {typeData.map((item, index) => (
                  <span key={item.name} className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: chartColors[index % chartColors.length] }}
                    />
                    {item.name} ({item.value})
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                  Premium snapshot
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Premium and coverage by policy
                </p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={premiumData} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.35} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                    <ChartTooltip
                      formatter={(value) =>
                        formatMoney(
                          typeof value === "number" ? value : Number(value ?? 0),
                          displayCurrency,
                        )
                      }
                    />
                    <Bar
                      dataKey="premium"
                      name="Premium"
                      fill="#38bdf8"
                      radius={[4, 4, 0, 0]}
                      animationDuration={900}
                    />
                    <Bar
                      dataKey="coverage"
                      name="Coverage"
                      fill="#818cf8"
                      radius={[4, 4, 0, 0]}
                      animationDuration={1100}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
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
      />
      {!policies || policies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 p-8 text-center text-sm text-slate-600 dark:text-slate-400">
          No insurance policies added yet.
        </div>
      ) : (
        <div className="space-y-4">
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
                  className="animate-[fade-in-up_0.5s_ease-out_both] rounded-2xl border border-slate-200 bg-white p-4 transition-shadow duration-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const Icon = INSURANCE_TYPE_ICONS[policy.type] ?? ShieldCheck;
                          return <Icon className="h-4 w-4 text-sky-400" aria-hidden="true" />;
                        })()}
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                          {policy.policyName}
                        </h3>
                        <span className="rounded-full border border-slate-300 dark:border-slate-700 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-600 dark:text-slate-400">
                          {TYPE_LABELS[policy.type]}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${STATUS_STYLES[summary.status]}`}
                        >
                          {summary.status}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {policy.provider} {policy.policyNumber ? ` · #${policy.policyNumber}` : ""}·
                        Sum assured
                        {formatMoney(
                          convertCurrency(policy.sumAssured, policy.currency, displayCurrency),
                          displayCurrency,
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openPaymentModal(policy)}
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white"
                      >
                        Record Premium Paid
                      </button>
                      <Tooltip content="Edit policy">
                        <button
                          onClick={() => openEditModal(policy)}
                          className="rounded-lg border border-slate-300 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </Tooltip>
                      <Tooltip content="Delete policy">
                        <button
                          onClick={() => handleDelete(policy)}
                          className="rounded-lg border border-slate-300 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3">
                      <div className="text-sm text-slate-600 dark:text-slate-400">Premium</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {formatMoney(
                          convertCurrency(policy.premiumAmount, policy.currency, displayCurrency),
                          displayCurrency,
                        )}
                        / {policy.premiumFrequency}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3">
                      <div className="text-sm text-slate-600 dark:text-slate-400">Next Due</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {formatDateOnly(summary.nextDueDate)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3">
                      <div className="text-sm text-slate-600 dark:text-slate-400">Total Paid</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {formatMoney(
                          convertCurrency(summary.totalPaid, policy.currency, displayCurrency),
                          displayCurrency,
                        )}
                      </div>
                    </div>
                  </div>
                  {policy.note && (
                    <div className="mt-3 text-sm text-slate-700 dark:text-slate-400">
                      {policy.note}
                    </div>
                  )}
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
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
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
      />
      {policyToPay && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl dark:bg-slate-900 dark:border-slate-800 w-full max-w-md shadow-2xl relative p-6">
            <Tooltip content="Close">
              <button
                onClick={() => setPolicyToPay(undefined)}
                className="absolute top-4 right-4 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                ×
              </button>
            </Tooltip>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Record premium payment
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {policyToPay.policyName} ·
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
      )}
    </div>
  );
}
