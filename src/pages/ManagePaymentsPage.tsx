import { useMemo, useState } from "react";
import type { Payment } from "../db/db";
import { useBackendResource } from "../services/backendHooks";
import { deletePayment } from "../services/backendSync";
import showConfirm from "../components/Confirm";
import AddPaymentModal from "../components/modals/AddPaymentModal";
import { fetchCards, fetchPayments } from "../services/backend.service";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
import PaginationControls from "../components/PaginationControls";

export default function ManagePaymentsPage() {
  const displayCurrency = useDisplayCurrency();
  const payments = useBackendResource(() => fetchPayments(), []);
  const cards = useBackendResource(() => fetchCards(), []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paymentToEdit, setPaymentToEdit] = useState<Payment | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (payments ?? []).filter((payment) => {
      const cardTitle = cards?.find((card) => card.id === payment.cardId)?.title ?? "";
      return (
        !query ||
        payment.cardId.toLowerCase().includes(query) ||
        cardTitle.toLowerCase().includes(query) ||
        payment.date.toLowerCase().includes(query)
      );
    });
  }, [payments, cards, search]);
  const visiblePayments = filteredPayments.slice((page - 1) * pageSize, page * pageSize);

  const openAddModal = () => {
    setPaymentToEdit(undefined);
    setIsModalOpen(true);
  };

  const openEditModal = (payment: Payment) => {
    setPaymentToEdit(payment);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          Manage Payments
        </h1>
        <button
          onClick={openAddModal}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Add Payment
        </button>
      </div>

      <input
        type="search"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        placeholder="Search dates or accounts"
        aria-label="Search payments"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-max">
          <thead className="bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">Date</th>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">Card ID</th>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">Amount</th>
              <th className="px-6 py-4 font-medium text-right text-slate-900 dark:text-slate-100">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
            {visiblePayments.map((payment) => (
              <tr
                key={payment.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors"
              >
                <td className="px-6 py-4">{new Date(payment.date).toLocaleDateString()}</td>
                <td className="px-6 py-4">{payment.cardId}</td>
                <td className="px-6 py-4">
                  {formatMoney(
                    convertCurrency(payment.amount, payment.currency, displayCurrency),
                    displayCurrency,
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => openEditModal(payment)}
                    className="text-blue-400 hover:text-blue-300 mr-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await showConfirm(
                        `Delete this payment of ${formatMoney(convertCurrency(payment.amount, payment.currency, displayCurrency), displayCurrency)}?`,
                        { title: "Delete payment", confirmText: "Delete" },
                      );
                      if (ok) await deletePayment(payment.id!);
                    }}
                    className="text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {filteredPayments.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                  {payments?.length ? "No payments match your search." : "No payments found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls
        page={page}
        totalItems={filteredPayments.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />

      <AddPaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialPayment={paymentToEdit}
      />
    </div>
  );
}
