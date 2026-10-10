import { useEffect, useMemo, useRef, useState } from "react";
import type { Bill } from "../db/db";
import { useBackendResource } from "../services/backendHooks";
import { fetchBills } from "../services/backend.service";
import { deleteBill, updateBill } from "../services/backendSync";
import AddBillModal from "../components/modals/AddBillModal";
import BillPaymentModal from "../components/BillPaymentModal";
import showConfirm from "../components/Confirm";
import {
  CalendarClock,
  Check,
  CircleAlert,
  CircleCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Pencil,
  Plus,
  Receipt,
  Trash2,
} from "lucide-react";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
import { showNetworkToast } from "../services/network.service";
import { BILL_TYPE_ICONS } from "../utils/typeIcons";
import { formatDateOnly, todayDateInput } from "../utils/date";
import Tooltip from "../components/Tooltip";
const TYPE_LABELS: Record<string, string> = {
  mobile: "Mobile",
  internet: "Internet",
  postpaid: "Postpaid",
  electricity: "Electricity",
  water: "Water",
  gas: "Gas",
  rent: "Rent",
  other: "Other",
};
function getStatus(bill: Bill) {
  if (bill.paid)
    return { label: "Paid", style: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" };
  if (bill.dueDate < todayDateInput())
    return { label: "Overdue", style: "border-rose-500/30 bg-rose-500/10 text-rose-300" };
  return { label: "Due", style: "border-amber-500/30 bg-amber-500/10 text-amber-300" };
}
export default function ManageBillsPage() {
  const displayCurrency = useDisplayCurrency();
  const bills = useBackendResource(() => fetchBills(), []);
  const hasCheckedCurrentMonth = useRef(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [billToEdit, setBillToEdit] = useState<Bill | undefined>();
  const [billToPay, setBillToPay] = useState<Bill | undefined>();
  const [billToView, setBillToView] = useState<Bill | undefined>();
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "unpaid">("unpaid");
  const [typeFilter, setTypeFilter] = useState<Bill["type"] | "all">("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  useEffect(() => {
    if (!bills || hasCheckedCurrentMonth.current) return;
    hasCheckedCurrentMonth.current = true;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (month !== currentMonth) return;

    const currentMonthBills = bills.filter((bill) => bill.dueDate.slice(0, 7) === currentMonth);
    if (currentMonthBills.length === 0 || !currentMonthBills.every((bill) => bill.paid)) return;

    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;
    const formatMonth = (date: Date) =>
      new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);

    setMonth(nextMonth);
    setPage(1);
    showNetworkToast(
      `All bills for ${formatMonth(now)} are already paid. Showing unpaid bills for ${formatMonth(nextMonthDate)}.`,
      "info",
    );
  }, [bills, month]);
  const filteredBills = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (bills ?? []).filter((bill) => {
      const matchesMonth = bill.dueDate.slice(0, 7) === month;
      const matchesSearch =
        !query ||
        [bill.name, bill.provider, bill.note].some((value) => value?.toLowerCase().includes(query));
      const matchesStatus =
        statusFilter === "all" || (statusFilter === "paid" ? bill.paid : !bill.paid);
      const matchesType = typeFilter === "all" || bill.type === typeFilter;
      return matchesMonth && matchesSearch && matchesStatus && matchesType;
    });
  }, [bills, month, search, statusFilter, typeFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredBills.length / pageSize));
  const visibleBills = filteredBills.slice((page - 1) * pageSize, page * pageSize);
  const openAddModal = () => {
    setBillToEdit(undefined);
    setIsModalOpen(true);
  };
  const openEditModal = (bill: Bill) => {
    setBillToEdit(bill);
    setIsModalOpen(true);
  };
  const markPaid = async (bill: Bill) => {
    if (bill.paid) {
      if (bill.id) await updateBill(bill.id, { paid: false });
      return;
    }
    setBillToPay(bill);
  };
  const handleDelete = async (bill: Bill) => {
    const ok = await showConfirm(`Delete "${bill.name}"? This cannot be undone.`, {
      title: "Delete bill",
      confirmText: "Delete",
    });
    if (ok && bill.id) await deleteBill(bill.id);
  };
  const unpaidTotal =
    filteredBills
      .filter((bill) => !bill.paid)
      .reduce(
        (total, bill) => total + convertCurrency(bill.amount, bill.currency, displayCurrency),
        0,
      ) ?? 0;
  const paidTotal = filteredBills
    .filter((bill) => bill.paid)
    .reduce(
      (total, bill) => total + convertCurrency(bill.amount, bill.currency, displayCurrency),
      0,
    );
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            Manage Bills
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Keep mobile, internet, utility, and recurring bills in one place.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" /> Add Bill
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">Bills shown</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {filteredBills.length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">Unpaid</div>
          <div className="mt-1 text-2xl font-semibold text-amber-600 dark:text-amber-300">
            {formatMoney(unpaidTotal, displayCurrency)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400">Paid</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-600 dark:text-emerald-300">
            {formatMoney(paidTotal, displayCurrency)}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const date = new Date(`${month}-01T00:00:00`);
              date.setMonth(date.getMonth() - 1);
              setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
              setPage(1);
            }}
            aria-label="Previous month"
            className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="month"
            value={month}
            onChange={(event) => {
              setMonth(event.target.value);
              setPage(1);
            }}
            aria-label="Select bill month"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={() => {
              const date = new Date(`${month}-01T00:00:00`);
              date.setMonth(date.getMonth() + 1);
              setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
              setPage(1);
            }}
            aria-label="Next month"
            className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:flex-1 sm:grid-cols-[minmax(0,2fr)_1fr_1fr]">
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search bills, providers, or notes"
            aria-label="Search bills"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as typeof statusFilter);
              setPage(1);
            }}
            aria-label="Filter bills by status"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="all">All statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
          </select>
          <select
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value as Bill["type"] | "all");
              setPage(1);
            }}
            aria-label="Filter bills by type"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="all">All bill types</option>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!bills || bills.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 p-10 text-center text-sm text-slate-600 dark:text-slate-400">
          <Receipt className="mx-auto mb-3 h-8 w-8 text-slate-400 dark:text-slate-600" /> No bills
          added yet. Add your first mobile, internet, or utility bill.
        </div>
      ) : filteredBills.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 p-10 text-center text-sm text-slate-600 dark:text-slate-400">
          No bills match the selected month and filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-100 dark:bg-slate-800/50 text-sm text-slate-900 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-4">Bill</th> <th className="px-5 py-4">Type</th>
                  <th className="px-5 py-4">Due date</th> <th className="px-5 py-4">Amount</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {visibleBills.map((bill) => {
                  const status = getStatus(bill);
                  return (
                    <tr key={bill.id} className="transition-colors hover:bg-slate-800/20">
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-2.5">
                          <Tooltip content={status.label}>
                            <span
                              className={`mt-0.5 ${
                                status.label === "Paid"
                                  ? "text-emerald-600 dark:text-emerald-300"
                                  : status.label === "Overdue"
                                    ? "text-rose-600 dark:text-rose-300"
                                    : "text-amber-600 dark:text-amber-300"
                              }`}
                            >
                              {status.label === "Paid" ? (
                                <CircleCheck className="h-4 w-4" aria-label="Paid" />
                              ) : status.label === "Overdue" ? (
                                <CircleAlert className="h-4 w-4" aria-label="Overdue" />
                              ) : (
                                <Clock3 className="h-4 w-4" aria-label="Due" />
                              )}
                            </span>
                          </Tooltip>
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {bill.name}
                            </div>
                            {bill.provider && (
                              <div className="text-xs text-slate-600 dark:text-slate-500">
                                {bill.provider}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm">
                        <span className="inline-flex items-center gap-2">
                          {(() => {
                            const Icon = BILL_TYPE_ICONS[bill.type] ?? Receipt;
                            return <Icon className="h-4 w-4 text-emerald-500" aria-hidden="true" />;
                          })()}
                          {TYPE_LABELS[bill.type] ?? bill.type}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-sm">
                          <CalendarClock className="h-4 w-4 text-slate-500" />
                          {formatDateOnly(bill.dueDate)}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-900 dark:text-slate-100">
                        {formatMoney(
                          convertCurrency(bill.amount, bill.currency, displayCurrency),
                          displayCurrency,
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Tooltip content="View bill details">
                            <button
                              type="button"
                              onClick={() => setBillToView(bill)}
                              aria-label={`View ${bill.name} details`}
                              className="rounded-lg border border-slate-300 p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-sky-600 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-sky-300"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </Tooltip>
                          <Tooltip content={bill.paid ? "Mark unpaid" : "Mark paid"}>
                            <button
                              onClick={() => markPaid(bill)}
                              className="rounded-lg border border-slate-300 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          </Tooltip>
                          <Tooltip content="Edit bill">
                            <button
                              onClick={() => openEditModal(bill)}
                              className="rounded-lg border border-slate-300 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </Tooltip>
                          <Tooltip content="Delete bill">
                            <button
                              onClick={() => handleDelete(bill)}
                              className="rounded-lg border border-slate-300 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {filteredBills.length > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
          <span>
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredBills.length)} of
            {filteredBills.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((current) => current - 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
            >
              Previous
            </button>
            <span className="px-2 py-1.5">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 dark:border-slate-700"
            >
              Next
            </button>
          </div>
        </div>
      )}
      <AddBillModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialBill={billToEdit}
      />
      {billToPay && <BillPaymentModal bill={billToPay} onClose={() => setBillToPay(undefined)} />}
      {billToView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <dialog
            open
            aria-labelledby="bill-details-title"
            className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="bill-details-title"
                  className="text-xl font-semibold text-slate-900 dark:text-slate-100"
                >
                  {billToView.name}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {billToView.provider || TYPE_LABELS[billToView.type] || billToView.type}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBillToView(undefined)}
                className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                Close
              </button>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4 text-sm">
              <div>
                <dt className="text-slate-500">Type</dt>
                <dd className="mt-1 font-medium">{TYPE_LABELS[billToView.type] ?? billToView.type}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd className="mt-1 font-medium">{getStatus(billToView).label}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Due date</dt>
                <dd className="mt-1 font-medium">{formatDateOnly(billToView.dueDate)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Amount</dt>
                <dd className="mt-1 font-medium">
                  {formatMoney(
                    convertCurrency(billToView.amount, billToView.currency, displayCurrency),
                    displayCurrency,
                  )}
                </dd>
              </div>
              {billToView.paidDate && (
                <div>
                  <dt className="text-slate-500">Paid date</dt>
                  <dd className="mt-1 font-medium">{formatDateOnly(billToView.paidDate)}</dd>
                </div>
              )}
              {billToView.paymentType && (
                <div>
                  <dt className="text-slate-500">Payment method</dt>
                  <dd className="mt-1 font-medium">{billToView.paymentType.toUpperCase()}</dd>
                </div>
              )}
              {billToView.paymentReference && (
                <div>
                  <dt className="text-slate-500">Payment reference</dt>
                  <dd className="mt-1 font-medium">{billToView.paymentReference}</dd>
                </div>
              )}
              {billToView.subscriptionFrequency && (
                <div>
                  <dt className="text-slate-500">Frequency</dt>
                  <dd className="mt-1 font-medium capitalize">
                    {billToView.subscriptionFrequency}
                  </dd>
                </div>
              )}
              {billToView.isSubscription && (
                <div>
                  <dt className="text-slate-500">Subscription</dt>
                  <dd className="mt-1 font-medium">Yes</dd>
                </div>
              )}
              {billToView.note && (
                <div className="col-span-2">
                  <dt className="text-slate-500">Note</dt>
                  <dd className="mt-1 whitespace-pre-wrap font-medium">{billToView.note}</dd>
                </div>
              )}
            </dl>
          </dialog>
        </div>
      )}
    </div>
  );
}
