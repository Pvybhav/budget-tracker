import { useState } from "react";
import { useBackendResource } from "../services/backendHooks";
import { type Card } from "../db/db";
import AddCardModal from "../components/modals/AddCardModal";
import showConfirm from "../components/Confirm";
import { getCardMetrics } from "../services/card.service";
import { deleteCard } from "../services/backendSync";
import {
  fetchCards,
  fetchExpenses,
  fetchPayments,
} from "../services/backend.service";

export default function ManageCardsPage() {
  const cards = useBackendResource(() => fetchCards(), []);
  const expenses = useBackendResource(() => fetchExpenses(), []);
  const payments = useBackendResource(() => fetchPayments(), []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardToEdit, setCardToEdit] = useState<Card | undefined>(undefined);

  const handleDelete = async (card: Card) => {
    const ok = await showConfirm(
      "Are you sure you want to delete this card? This will also delete ALL related expenses and payments!",
      { title: "Delete card", confirmText: "Delete" },
    );
    if (ok) {
      await deleteCard(card.id!);
    }
  };

  const openAddModal = () => {
    setCardToEdit(undefined);
    setIsModalOpen(true);
  };

  const openEditModal = (card: Card) => {
    setCardToEdit(card);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-slate-100">
          Manage Accounts
        </h1>
        <button
          onClick={openAddModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Add New Account
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-slate-300 whitespace-nowrap min-w-max">
          <thead className="bg-slate-800/50">
            <tr>
              <th className="px-6 py-4 font-medium">Title</th>
              <th className="px-6 py-4 font-medium">Type</th>
              <th className="px-6 py-4 font-medium">Billing Date</th>
              <th className="px-6 py-4 font-medium">Payment Date</th>
              <th className="px-6 py-4 font-medium">Limit / Balance</th>
              <th className="px-6 py-4 font-medium">Current Balance</th>
              <th className="px-6 py-4 font-medium">AMC</th>
              <th className="px-6 py-4 font-medium">Waiver Limit</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {cards?.map((card) => {
              const cardExpenses =
                expenses?.filter((e) => e.cardId === card.id) || [];
              const cardPayments =
                payments?.filter((p) => p.cardId === card.id) || [];
              const metrics = getCardMetrics(
                card,
                cardExpenses,
                cardPayments,
                cards || [],
              );
              const currentBalance = metrics.currentBalance;
              const accountTypeLabel =
                card.type === "debit"
                  ? "Debit Card"
                  : card.type === "meal"
                    ? "Meal Card"
                    : card.type === "wallet"
                      ? "UPI Wallet"
                      : card.type === "other"
                        ? "Other"
                        : "Credit Card";

              return (
                <tr
                  key={card.id}
                  className="hover:bg-slate-800/20 transition-colors"
                >
                  <td className="px-6 py-4">{card.title}</td>
                  <td className="px-6 py-4">{accountTypeLabel}</td>
                  <td className="px-6 py-4">
                    {card.type === "credit" ? card.billingDate : "—"}
                  </td>
                  <td className="px-6 py-4">
                    {card.type === "credit" ? card.paymentDate : "—"}
                  </td>
                  <td className="px-6 py-4">₹{card.totalLimit}</td>
                  <td className="px-6 py-4 text-emerald-400 font-medium">
                    ₹{currentBalance}
                  </td>
                  <td className="px-6 py-4">
                    {card.type === "credit" ? `₹${card.amc ?? 0}` : "—"}
                  </td>
                  <td className="px-6 py-4">
                    {card.type === "credit"
                      ? `₹${card.waiveOffLimit ?? 0}`
                      : "—"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openEditModal(card)}
                      className="text-blue-400 hover:text-blue-300 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(card)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {(!cards || cards.length === 0) && (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-12 text-center text-slate-500"
                >
                  No cards found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AddCardModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialCard={cardToEdit}
      />
    </div>
  );
}
