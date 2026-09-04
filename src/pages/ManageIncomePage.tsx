import { useMemo, useState } from "react";
import type { Income } from "../db/db";
import { useBackendResource } from "../services/backendHooks";
import { fetchIncomes, fetchCards } from "../services/backend.service";
import { deleteIncome } from "../services/backendSync";
import AddIncomeModal from "../components/modals/AddIncomeModal";
import showConfirm from "../components/Confirm";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
import PaginationControls from "../components/PaginationControls";
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
  const displayCurrency = useDisplayCurrency();
  const income = useBackendResource(() => fetchIncomes(), []);
  const cards = useBackendResource(() => fetchCards(), []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [incomeToEdit, setIncomeToEdit] = useState<Income | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const openAddModal = () => {
    setIncomeToEdit(undefined);
    setIsModalOpen(true);
  };
  const openEditModal = (item: Income) => {
    setIncomeToEdit(item);
    setIsModalOpen(true);
  };
  const cardTitleFor = (accountId?: string) =>
    accountId ? (cards?.find((c) => c.id === accountId)?.title ?? `#${accountId}`) : "—";
  const sorted = useMemo(
    () => [...(income ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [income],
  );
  const filteredIncome = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sorted.filter(
      (item) =>
        !query ||
        item.source.toLowerCase().includes(query) ||
        CATEGORY_LABELS[item.category ?? "other"].toLowerCase().includes(query) ||
        (cards?.find((card) => card.id === item.accountId)?.title ?? "")
          .toLowerCase()
          .includes(query) ||
        item.note?.toLowerCase().includes(query),
    );
  }, [sorted, search, cards]);
  const visibleIncome = filteredIncome.slice((page - 1) * pageSize, page * pageSize);
  const totalThisMonth = useMemo(() => {
    const now = new Date();
    return sorted
      .filter((i) => {
        const d = new Date(i.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, i) => sum + convertCurrency(i.amount, i.currency, displayCurrency), 0);
  }, [sorted, displayCurrency]);
  return (
    <div className="space-y-6">
      {" "}
      <div className="flex items-center justify-between">
        {" "}
        <div>
          {" "}
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            {" "}
            Manage Income{" "}
          </h1>{" "}
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
      <input
        type="search"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        placeholder="Search sources, categories, or accounts"
        aria-label="Search income"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />{" "}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 p-5">
        {" "}
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-500">
          {" "}
          This month{" "}
        </div>{" "}
        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
          {" "}
          {formatMoney(totalThisMonth, displayCurrency)}{" "}
        </div>{" "}
      </div>{" "}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
        {" "}
        <table className="w-full text-left text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-max">
          {" "}
          <thead className="bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
            {" "}
            <tr>
              {" "}
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                Date
              </th>{" "}
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">Source</th>{" "}
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">Category</th>{" "}
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                Credited To
              </th>{" "}
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">Amount</th>{" "}
              <th className="px-6 py-4 font-medium text-right text-slate-900 dark:text-slate-100">
                Actions
              </th>{" "}
            </tr>{" "}
          </thead>{" "}
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
            {" "}
            {visibleIncome.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors"
              >
                {" "}
                <td className="px-6 py-4"> {new Date(item.date).toLocaleDateString()} </td>{" "}
                <td className="px-6 py-4">{item.source}</td>{" "}
                <td className="px-6 py-4"> {CATEGORY_LABELS[item.category ?? "other"]} </td>{" "}
                <td className="px-6 py-4">{cardTitleFor(item.accountId)}</td>{" "}
                <td className="px-6 py-4 text-emerald-400">
                  {" "}
                  {formatMoney(
                    convertCurrency(item.amount, item.currency, displayCurrency),
                    displayCurrency,
                  )}{" "}
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
            {filteredIncome.length === 0 && (
              <tr>
                {" "}
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  {" "}
                  {income?.length
                    ? "No income matches your search."
                    : "No income recorded yet."}{" "}
                </td>{" "}
              </tr>
            )}{" "}
          </tbody>{" "}
        </table>{" "}
      </div>{" "}
      <PaginationControls
        page={page}
        totalItems={filteredIncome.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />{" "}
      <AddIncomeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialIncome={incomeToEdit}
      />{" "}
    </div>
  );
}
