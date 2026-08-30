import { useState } from "react";
import type { Bill } from "../db/db";
import { useBackendResource } from "../services/backendHooks";
import { fetchBills } from "../services/backend.service";
import { deleteBill, updateBill } from "../services/backendSync";
import AddBillModal from "../components/modals/AddBillModal";
import showConfirm from "../components/Confirm";
import { CalendarClock, Check, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
const TYPE_LABELS: Record<string, string> = {
  mobile: "Mobile",
  internet: "Internet",
  postpaid: "Postpaid",
  electricity: "Electricity",
  water: "Water",
  gas: "Gas",
  other: "Other",
};
function getStatus(bill: Bill) {
  if (bill.paid)
    return { label: "Paid", style: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" };
  if (bill.dueDate < new Date().toISOString().slice(0, 10))
    return { label: "Overdue", style: "border-rose-500/30 bg-rose-500/10 text-rose-300" };
  return { label: "Due", style: "border-amber-500/30 bg-amber-500/10 text-amber-300" };
}
export default function ManageBillsPage() {
  const bills = useBackendResource(() => fetchBills(), []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [billToEdit, setBillToEdit] = useState<Bill | undefined>();
  const openAddModal = () => {
    setBillToEdit(undefined);
    setIsModalOpen(true);
  };
  const openEditModal = (bill: Bill) => {
    setBillToEdit(bill);
    setIsModalOpen(true);
  };
  const markPaid = async (bill: Bill) => {
    if (bill.id) await updateBill(bill.id, { paid: !bill.paid });
  };
  const handleDelete = async (bill: Bill) => {
    const ok = await showConfirm(`Delete "${bill.name}"? This cannot be undone.`, {
      title: "Delete bill",
      confirmText: "Delete",
    });
    if (ok && bill.id) await deleteBill(bill.id);
  };
  const unpaidTotal =
    bills?.filter((bill) => !bill.paid).reduce((total, bill) => total + bill.amount, 0) ?? 0;
  return (
    <div className="space-y-6">
      {" "}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {" "}
        <div>
          {" "}
          <h1 className="text-3xl font-semibold text-slate-100"> Manage Bills </h1>{" "}
          <p className="mt-1 text-sm text-slate-400">
            {" "}
            Keep mobile, internet, utility, and recurring bills in one place.{" "}
          </p>{" "}
        </div>{" "}
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-700"
        >
          {" "}
          <Plus className="h-4 w-4" /> Add Bill{" "}
        </button>{" "}
      </div>{" "}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {" "}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          {" "}
          <div className="text-sm text-slate-400">All bills</div>{" "}
          <div className="mt-1 text-2xl font-semibold text-slate-100">
            {" "}
            {bills?.length ?? 0}{" "}
          </div>{" "}
        </div>{" "}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          {" "}
          <div className="text-sm text-slate-400">Outstanding</div>{" "}
          <div className="mt-1 text-2xl font-semibold text-amber-300">
            {" "}
            ₹{unpaidTotal.toLocaleString("en-IN")}{" "}
          </div>{" "}
        </div>{" "}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          {" "}
          <div className="text-sm text-slate-400">Paid</div>{" "}
          <div className="mt-1 text-2xl font-semibold text-emerald-300">
            {" "}
            {bills?.filter((bill) => bill.paid).length ?? 0}{" "}
          </div>{" "}
        </div>{" "}
      </div>{" "}
      {!bills || bills.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-10 text-center text-sm text-slate-400">
          {" "}
          <Receipt className="mx-auto mb-3 h-8 w-8 text-slate-600" /> No bills added yet. Add your
          first mobile, internet, or utility bill.{" "}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
          {" "}
          <div className="overflow-x-auto">
            {" "}
            <table className="w-full min-w-[680px] text-left text-slate-300">
              {" "}
              <thead className="bg-slate-800/50 text-sm text-slate-400">
                {" "}
                <tr>
                  {" "}
                  <th className="px-5 py-4">Bill</th> <th className="px-5 py-4">Type</th>{" "}
                  <th className="px-5 py-4">Due date</th> <th className="px-5 py-4">Amount</th>{" "}
                  <th className="px-5 py-4">Status</th>{" "}
                  <th className="px-5 py-4 text-right">Actions</th>{" "}
                </tr>{" "}
              </thead>{" "}
              <tbody className="divide-y divide-slate-800/60">
                {" "}
                {bills.map((bill) => {
                  const status = getStatus(bill);
                  return (
                    <tr key={bill.id} className="transition-colors hover:bg-slate-800/20">
                      {" "}
                      <td className="px-5 py-4">
                        {" "}
                        <div className="font-medium text-slate-100"> {bill.name} </div>{" "}
                        {bill.provider && (
                          <div className="text-xs text-slate-500"> {bill.provider} </div>
                        )}{" "}
                      </td>{" "}
                      <td className="px-5 py-4 text-sm"> {TYPE_LABELS[bill.type] ?? bill.type} </td>{" "}
                      <td className="px-5 py-4">
                        {" "}
                        <div className="flex items-center gap-2 text-sm">
                          {" "}
                          <CalendarClock className="h-4 w-4 text-slate-500" />{" "}
                          {new Date(`${bill.dueDate}T00:00:00`).toLocaleDateString()}{" "}
                        </div>{" "}
                      </td>{" "}
                      <td className="px-5 py-4 font-medium text-slate-100">
                        {" "}
                        ₹ {bill.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}{" "}
                      </td>{" "}
                      <td className="px-5 py-4">
                        {" "}
                        <span className={`rounded-full border px-2 py-1 text-xs ${status.style}`}>
                          {" "}
                          {status.label}{" "}
                        </span>{" "}
                      </td>{" "}
                      <td className="px-5 py-4 text-right">
                        {" "}
                        <div className="flex justify-end gap-2">
                          {" "}
                          <button
                            onClick={() => markPaid(bill)}
                            className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-emerald-300"
                            title={bill.paid ? "Mark unpaid" : "Mark paid"}
                          >
                            {" "}
                            <Check className="h-4 w-4" />{" "}
                          </button>{" "}
                          <button
                            onClick={() => openEditModal(bill)}
                            className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-white"
                            title="Edit bill"
                          >
                            {" "}
                            <Pencil className="h-4 w-4" />{" "}
                          </button>{" "}
                          <button
                            onClick={() => handleDelete(bill)}
                            className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-rose-400"
                            title="Delete bill"
                          >
                            {" "}
                            <Trash2 className="h-4 w-4" />{" "}
                          </button>{" "}
                        </div>{" "}
                      </td>{" "}
                    </tr>
                  );
                })}{" "}
              </tbody>{" "}
            </table>{" "}
          </div>{" "}
        </div>
      )}{" "}
      <AddBillModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialBill={billToEdit}
      />{" "}
    </div>
  );
}
