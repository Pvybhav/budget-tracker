import { useState } from "react";
import type { InsurancePolicy } from "../db/db";
import { useBackendResource } from "../services/backendHooks";
import { fetchInsurancePolicies } from "../services/backend.service";
import { deleteInsurancePolicy, updateInsurancePolicy } from "../services/backendSync";
import { getInsurancePolicySummary } from "../services/insurance.service";
import AddInsuranceModal from "../components/modals/AddInsuranceModal";
import showConfirm from "../components/Confirm";
import { Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";
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
  expired: "border-slate-700 bg-slate-800 text-slate-400",
};
export default function ManageInsurancePage() {
  const policies = useBackendResource(() => fetchInsurancePolicies(), []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [policyToEdit, setPolicyToEdit] = useState<InsurancePolicy | undefined>();
  const openAddModal = () => {
    setPolicyToEdit(undefined);
    setIsModalOpen(true);
  };
  const openEditModal = (policy: InsurancePolicy) => {
    setPolicyToEdit(policy);
    setIsModalOpen(true);
  };
  const handleDelete = async (policy: InsurancePolicy) => {
    const ok = await showConfirm(`Delete "${policy.policyName}"? This cannot be undone.`, {
      title: "Delete policy",
      confirmText: "Delete",
    });
    if (ok) await deleteInsurancePolicy(policy.id!);
  };
  const recordPremiumPayment = async (policy: InsurancePolicy) => {
    if (!policy.id) return;
    const payments = [
      ...(policy.premiumPayments ?? []),
      { date: new Date().toISOString().slice(0, 10), amount: policy.premiumAmount },
    ];
    await updateInsurancePolicy(policy.id, { premiumPayments: payments });
  };
  return (
    <div className="space-y-6">
      {" "}
      <div className="flex items-center justify-between">
        {" "}
        <div>
          {" "}
          <h1 className="text-3xl font-semibold text-slate-100"> Manage Insurance </h1>{" "}
          <p className="mt-1 text-sm text-slate-400">
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
      {!policies || policies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-8 text-center text-sm text-slate-400">
          {" "}
          No insurance policies added yet.{" "}
        </div>
      ) : (
        <div className="space-y-4">
          {" "}
          {policies.map((policy) => {
            const summary = getInsurancePolicySummary(policy);
            return (
              <div
                key={policy.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
              >
                {" "}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  {" "}
                  <div className="space-y-1">
                    {" "}
                    <div className="flex items-center gap-2">
                      {" "}
                      <ShieldCheck className="h-4 w-4 text-sky-400" />{" "}
                      <h3 className="font-semibold text-slate-100"> {policy.policyName} </h3>{" "}
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-400">
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
                    <div className="text-sm text-slate-400">
                      {" "}
                      {policy.provider} {policy.policyNumber ? ` · #${policy.policyNumber}` : ""} ·
                      Sum assured ₹{policy.sumAssured.toLocaleString("en-IN")}{" "}
                    </div>{" "}
                  </div>{" "}
                  <div className="flex items-center gap-2">
                    {" "}
                    <button
                      onClick={() => recordPremiumPayment(policy)}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white"
                    >
                      {" "}
                      Record Premium Paid{" "}
                    </button>{" "}
                    <button
                      onClick={() => openEditModal(policy)}
                      className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-white"
                      title="Edit policy"
                    >
                      {" "}
                      <Pencil className="h-4 w-4" />{" "}
                    </button>{" "}
                    <button
                      onClick={() => handleDelete(policy)}
                      className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-rose-400"
                      title="Delete policy"
                    >
                      {" "}
                      <Trash2 className="h-4 w-4" />{" "}
                    </button>{" "}
                  </div>{" "}
                </div>{" "}
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {" "}
                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    {" "}
                    <div className="text-sm text-slate-400">Premium</div>{" "}
                    <div className="mt-1 text-lg font-semibold text-slate-100">
                      {" "}
                      ₹{policy.premiumAmount.toLocaleString("en-IN")} /{" "}
                      {policy.premiumFrequency}{" "}
                    </div>{" "}
                  </div>{" "}
                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    {" "}
                    <div className="text-sm text-slate-400">Next Due</div>{" "}
                    <div className="mt-1 text-lg font-semibold text-slate-100">
                      {" "}
                      {new Date(summary.nextDueDate).toLocaleDateString()}{" "}
                    </div>{" "}
                  </div>{" "}
                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    {" "}
                    <div className="text-sm text-slate-400">Total Paid</div>{" "}
                    <div className="mt-1 text-lg font-semibold text-slate-100">
                      {" "}
                      ₹{summary.totalPaid.toLocaleString("en-IN")}{" "}
                    </div>{" "}
                  </div>{" "}
                </div>{" "}
                {policy.note && (
                  <div className="mt-3 text-sm text-slate-400"> {policy.note} </div>
                )}{" "}
              </div>
            );
          })}{" "}
        </div>
      )}{" "}
      <AddInsuranceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialPolicy={policyToEdit}
      />{" "}
    </div>
  );
}
