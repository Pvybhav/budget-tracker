import { useMemo, useState } from "react";
import { Pencil, Plus, TrendingDown, TrendingUp, Trash2 } from "lucide-react";
import type { Investment } from "../db/db";
import { useBackendResource } from "../services/backendHooks";
import { fetchInvestments } from "../services/backend.service";
import { deleteInvestment } from "../services/backendSync";
import showConfirm from "./Confirm";
import AddInvestmentModal from "./modals/AddInvestmentModal";
function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
const typeLabels: Record<Investment["type"], string> = {
  equity: "Equity",
  "mutual-fund": "Mutual Fund",
  etf: "ETF",
  bond: "Bond",
  other: "Other",
};
export default function InvestmentsSection() {
  const investments = useBackendResource(() => fetchInvestments(), []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | undefined>();
  const totals = useMemo(() => {
    const rows = investments ?? [];
    const invested = rows.reduce((sum, item) => sum + item.investedAmount, 0);
    const current = rows.reduce((sum, item) => sum + item.currentValue, 0);
    return { invested, current, gain: current - invested };
  }, [investments]);
  const openCreateModal = () => {
    setSelectedInvestment(undefined);
    setIsModalOpen(true);
  };
  const openEditModal = (investment: Investment) => {
    setSelectedInvestment(investment);
    setIsModalOpen(true);
  };
  const handleDelete = async (investment: Investment) => {
    if (!investment.id) return;
    const ok = await showConfirm(`Delete the investment "${investment.name}"?`, {
      title: "Delete investment",
      confirmText: "Delete",
    });
    if (ok) await deleteInvestment(investment.id);
  };
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      {" "}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {" "}
        <div>
          {" "}
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {" "}
            Investments{" "}
          </div>{" "}
          <h2 className="text-lg font-bold text-slate-100">
            {" "}
            Equity, mutual funds, and more{" "}
          </h2>{" "}
          <p className="mt-1 text-sm text-slate-400">
            {" "}
            Track holdings across Zerodha, 5Paisa, and other platforms.{" "}
          </p>{" "}
        </div>{" "}
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700"
        >
          {" "}
          <Plus className="h-4 w-4" /> Add investment{" "}
        </button>{" "}
      </div>{" "}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {" "}
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          {" "}
          <div className="text-sm text-slate-400">Invested</div>{" "}
          <div className="mt-1 text-lg font-semibold text-slate-100">
            {" "}
            {formatCurrency(totals.invested)}{" "}
          </div>{" "}
        </div>{" "}
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          {" "}
          <div className="text-sm text-slate-400">Current value</div>{" "}
          <div className="mt-1 text-lg font-semibold text-cyan-400">
            {" "}
            {formatCurrency(totals.current)}{" "}
          </div>{" "}
        </div>{" "}
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          {" "}
          <div className="flex items-center gap-2 text-sm text-slate-400">
            {" "}
            {totals.gain >= 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-rose-400" />
            )}{" "}
            Gain / loss{" "}
          </div>{" "}
          <div
            className={`mt-1 text-lg font-semibold ${totals.gain >= 0 ? "text-emerald-400" : "text-rose-400"}`}
          >
            {" "}
            {formatCurrency(totals.gain)}{" "}
          </div>{" "}
        </div>{" "}
      </div>{" "}
      {investments && investments.length > 0 ? (
        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-800">
          {" "}
          <table className="w-full min-w-[760px] text-left text-sm text-slate-300">
            {" "}
            <thead className="bg-slate-800/50 text-slate-400">
              {" "}
              <tr>
                {" "}
                <th className="px-4 py-3 font-medium">Investment</th>{" "}
                <th className="px-4 py-3 font-medium">Platform</th>{" "}
                <th className="px-4 py-3 font-medium">Type</th>{" "}
                <th className="px-4 py-3 font-medium text-right">Units</th>{" "}
                <th className="px-4 py-3 font-medium text-right"> Current value </th>{" "}
                <th className="px-4 py-3 font-medium">Updated</th>{" "}
                <th className="px-4 py-3 text-right font-medium">Actions</th>{" "}
              </tr>{" "}
            </thead>{" "}
            <tbody className="divide-y divide-slate-800">
              {" "}
              {investments.map((investment) => {
                const gain = investment.currentValue - investment.investedAmount;
                return (
                  <tr key={investment.id} className="hover:bg-slate-800/20">
                    {" "}
                    <td className="px-4 py-3">
                      {" "}
                      <div className="font-medium text-slate-100"> {investment.name} </div>{" "}
                      {investment.note && (
                        <div className="mt-0.5 text-xs text-slate-500"> {investment.note} </div>
                      )}{" "}
                    </td>{" "}
                    <td className="px-4 py-3">{investment.platform}</td>{" "}
                    <td className="px-4 py-3">{typeLabels[investment.type]}</td>{" "}
                    <td className="px-4 py-3 text-right">
                      {" "}
                      {investment.quantity.toLocaleString("en-IN")}{" "}
                    </td>{" "}
                    <td className="px-4 py-3 text-right">
                      {" "}
                      <div className="font-medium text-slate-100">
                        {" "}
                        {formatCurrency(investment.currentValue)}{" "}
                      </div>{" "}
                      <div
                        className={gain >= 0 ? "text-xs text-emerald-400" : "text-xs text-rose-400"}
                      >
                        {" "}
                        {gain >= 0 ? "+" : ""} {formatCurrency(gain)}{" "}
                      </div>{" "}
                    </td>{" "}
                    <td className="px-4 py-3">{investment.purchaseDate}</td>{" "}
                    <td className="px-4 py-3 text-right">
                      {" "}
                      <button
                        type="button"
                        onClick={() => openEditModal(investment)}
                        className="mr-2 rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-white"
                        title="Edit investment"
                      >
                        {" "}
                        <Pencil className="h-4 w-4" />{" "}
                      </button>{" "}
                      <button
                        type="button"
                        onClick={() => handleDelete(investment)}
                        className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-rose-400"
                        title="Delete investment"
                      >
                        {" "}
                        <Trash2 className="h-4 w-4" />{" "}
                      </button>{" "}
                    </td>{" "}
                  </tr>
                );
              })}{" "}
            </tbody>{" "}
          </table>{" "}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-8 text-center text-sm text-slate-400">
          {" "}
          No investments recorded yet. Add your first holding to start tracking your portfolio.{" "}
        </div>
      )}{" "}
      <AddInvestmentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedInvestment(undefined);
        }}
        initialInvestment={selectedInvestment}
      />{" "}
    </section>
  );
}
