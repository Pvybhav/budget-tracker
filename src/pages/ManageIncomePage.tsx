import { useMemo, useState } from "react";
import type { Income } from "../db/db";
import { useBackendResource } from "../services/backendHooks";
import { fetchIncomes, fetchCards } from "../services/backend.service";
import { deleteIncome } from "../services/backendSync";
import AddIncomeModal from "../components/modals/AddIncomeModal";
import showConfirm from "../components/Confirm";
import { Plus, Pencil, Trash2 } from "lucide-react";
const CATEGORY_LABELS: Record<string, string> = {
  salary: "Salary",
  freelance: "Freelance",
  business: "Business",
  interest: "Interest",
  dividend: "Dividend",
  refund: "Refund",
  gift: "Gift",
  other: "Other",
};
export default function ManageIncomePage() {
  const income = useBackendResource(() => fetchIncomes(), []);
  const cards = useBackendResource(() => fetchCards(), []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [incomeToEdit, setIncomeToEdit] = useState<Income | undefined>(undefined);
  const openAddModal = () => {
    setIncomeToEdit(undefined);
    setIsModalOpen(true);
  };
  const openEditModal = (item: Income) => {
    setIncomeToEdit(item);
    setIsModalOpen(true);
  };
  const cardTitleFor = (accountId?: number) =>
    accountId ? (cards?.find((c) => c.id === accountId)?.title ?? `#${accountId}`) : "—";
  const sorted = useMemo(
    () => [...(income ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [income],
  );
  const totalThisMonth = useMemo(() => {
    const now = new Date();
    return sorted
      .filter((i) => {
        const d = new Date(i.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, i) => sum + i.amount, 0);
  }, [sorted]);
  return (
    <div className="space-y-6">
      {" "}
      <div className="flex items-center justify-between">
        {" "}
        <div>
          {" "}
          <h1 className="text-3xl font-semibold text-slate-100"> Manage Income </h1>{" "}
          <p className="mt-1 text-sm text-slate-400">
            {" "}
            Track salary and every other rupee coming in.{" "}
          </p>{" "}
        </div>{" "}
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {" "}
          <Plus className="w-4 h-4" /> Add Income{" "}
        </button>{" "}
      </div>{" "}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        {" "}
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          {" "}
          This month{" "}
        </div>{" "}
        <div className="text-2xl font-bold text-emerald-400 mt-1">
          {" "}
          ₹{" "}
          {totalThisMonth.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{" "}
        </div>{" "}
      </div>{" "}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
        {" "}
        <table className="w-full text-left text-slate-300 whitespace-nowrap min-w-max">
          {" "}
          <thead className="bg-slate-800/50">
            {" "}
            <tr>
              {" "}
              <th className="px-6 py-4 font-medium">Date</th>{" "}
              <th className="px-6 py-4 font-medium">Source</th>{" "}
              <th className="px-6 py-4 font-medium">Category</th>{" "}
              <th className="px-6 py-4 font-medium">Credited To</th>{" "}
              <th className="px-6 py-4 font-medium">Amount</th>{" "}
              <th className="px-6 py-4 font-medium text-right">Actions</th>{" "}
            </tr>{" "}
          </thead>{" "}
          <tbody className="divide-y divide-slate-800/50">
            {" "}
            {sorted.map((item) => (
              <tr key={item.id} className="hover:bg-slate-800/20 transition-colors">
                {" "}
                <td className="px-6 py-4"> {new Date(item.date).toLocaleDateString()} </td>{" "}
                <td className="px-6 py-4">{item.source}</td>{" "}
                <td className="px-6 py-4"> {CATEGORY_LABELS[item.category ?? "other"]} </td>{" "}
                <td className="px-6 py-4">{cardTitleFor(item.accountId)}</td>{" "}
                <td className="px-6 py-4 text-emerald-400">
                  {" "}
                  ₹{" "}
                  {item.amount.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                </td>{" "}
                <td className="px-6 py-4 text-right">
                  {" "}
                  <button
                    onClick={() => openEditModal(item)}
                    className="text-blue-400 hover:text-blue-300 mr-3"
                  >
                    {" "}
                    <Pencil className="w-4 h-4 inline" />{" "}
                  </button>{" "}
                  <button
                    onClick={async () => {
                      if (!item.id) return;
                      const ok = await showConfirm(`Delete income entry "${item.source}"?`, {
                        title: "Delete income",
                        confirmText: "Delete",
                      });
                      if (ok) await deleteIncome(item.id);
                    }}
                    className="text-red-400 hover:text-red-300"
                  >
                    {" "}
                    <Trash2 className="w-4 h-4 inline" />{" "}
                  </button>{" "}
                </td>{" "}
              </tr>
            ))}{" "}
            {sorted.length === 0 && (
              <tr>
                {" "}
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  {" "}
                  No income recorded yet.{" "}
                </td>{" "}
              </tr>
            )}{" "}
          </tbody>{" "}
        </table>{" "}
      </div>{" "}
      <AddIncomeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialIncome={incomeToEdit}
      />{" "}
    </div>
  );
}
