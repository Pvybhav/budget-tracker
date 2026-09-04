import { useMemo, useState } from "react";
import { useBackendResource } from "../services/backendHooks";
import { type Card } from "../db/db";
import AddCardModal from "../components/modals/AddCardModal";
import showConfirm from "../components/Confirm";
import { getCardMetrics, getCreditUtilization } from "../services/card.service";
import { deleteCard } from "../services/backendSync";
import {
  fetchCards,
  fetchExpenses,
  fetchPayments,
  fetchIncomes,
  fetchTransfers,
} from "../services/backend.service";
import { convertCurrency, formatMoney, useDisplayCurrency } from "../services/currency.service";
import { ACCOUNT_TYPE_ICONS, CARD_ICONS } from "../utils/typeIcons";
import PaginationControls from "../components/PaginationControls";

function getAccountTypeLabel(type: Card["type"]) {
  const labels: Record<NonNullable<Card["type"]>, string> = {
    credit: "Credit Card",
    debit: "Debit Card",
    bank: "Bank Account",
    meal: "Meal Card",
    wallet: "UPI Wallet",
    cash: "Cash",
    gift: "Gift Card",
    other: "Other",
  };
  return labels[type ?? "other"];
}

export default function ManageCardsPage() {
  const displayCurrency = useDisplayCurrency();
  const cards = useBackendResource(() => fetchCards(), []);
  const expenses = useBackendResource(() => fetchExpenses(), []);
  const payments = useBackendResource(() => fetchPayments(), []);
  const incomes = useBackendResource(() => fetchIncomes(), []);
  const transfers = useBackendResource(() => fetchTransfers(), []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardToEdit, setCardToEdit] = useState<Card | undefined>(undefined);
  const [accountView, setAccountView] = useState<"hierarchy" | "flat">("hierarchy");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const searchableCards = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (cards ?? []).filter(
      (card) =>
        !query ||
        card.title.toLowerCase().includes(query) ||
        getAccountTypeLabel(card.type).toLowerCase().includes(query) ||
        card.bankName?.toLowerCase().includes(query),
    );
  }, [cards, search]);
  const displayCards = useMemo(() => {
    if (accountView === "flat") return searchableCards.map((card) => ({ card, depth: 0 }));
    const childrenByParent = new Map<string, Card[]>();
    for (const card of searchableCards) {
      const parentId = card.linkedCardIds?.[0];
      if (!parentId) continue;
      const children = childrenByParent.get(parentId) ?? [];
      children.push(card);
      childrenByParent.set(parentId, children);
    }
    const ordered: { card: Card; depth: number }[] = [];
    const addBranch = (card: Card, depth: number) => {
      ordered.push({ card, depth });
      for (const child of childrenByParent.get(card.id ?? "") ?? []) addBranch(child, depth + 1);
    };
    const childIds = new Set(
      searchableCards.flatMap((card) => (card.linkedCardIds ?? []).slice(0, 1)),
    );
    for (const card of searchableCards) {
      if (!childIds.has(card.id ?? "")) addBranch(card, 0);
    }
    return ordered;
  }, [searchableCards, accountView]);
  const visibleCards = displayCards.slice((page - 1) * pageSize, page * pageSize);

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
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          Manage Accounts
        </h1>
        <button
          onClick={openAddModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Add New Account
        </button>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/60 p-3 dark:border-slate-800 dark:bg-slate-900/60">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Account view
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Linked cards appear beneath their master account.
          </div>
        </div>
        <div
          className="flex rounded-lg border border-slate-300 p-1 dark:border-slate-700"
          aria-label="Account view"
        >
          {(["hierarchy", "flat"] as const).map((view) => (
            <button
              key={view}
              type="button"
              onClick={() => setAccountView(view)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${accountView === view ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-400"}`}
            >
              {view}
            </button>
          ))}
        </div>
      </div>

      <input
        type="search"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        placeholder="Search accounts, types, or banks"
        aria-label="Search accounts"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-max">
          <thead className="bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">Title</th>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">Type</th>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                Billing Date
              </th>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                Payment Date
              </th>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                Limit / Balance
              </th>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                Current Balance
              </th>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                Utilization
              </th>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">AMC</th>
              <th className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                Waiver Limit
              </th>
              <th className="px-6 py-4 font-medium text-right text-slate-900 dark:text-slate-100">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
            {visibleCards.map(({ card, depth }) => {
              const cardExpenses = expenses?.filter((e) => e.cardId === card.id) || [];
              const cardPayments = payments?.filter((p) => p.cardId === card.id) || [];
              const metrics = getCardMetrics(card, cardExpenses, cardPayments, cards || []);
              const accountIncome =
                incomes
                  ?.filter((income) => income.accountId === card.id)
                  .reduce((sum, income) => sum + income.amount, 0) ?? 0;
              const transferIn =
                transfers
                  ?.filter((transfer) => transfer.toAccountId === card.id)
                  .reduce((sum, transfer) => sum + transfer.amount, 0) ?? 0;
              const transferOut =
                transfers
                  ?.filter((transfer) => transfer.fromAccountId === card.id)
                  .reduce((sum, transfer) => sum + transfer.amount, 0) ?? 0;
              const currentBalance =
                card.type === "credit"
                  ? metrics.currentBalance
                  : metrics.currentBalance + accountIncome + transferIn - transferOut;
              const utilization =
                card.type === "credit"
                  ? getCreditUtilization(card.totalLimit ?? 0, currentBalance)
                  : null;
              return (
                <tr key={card.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div
                      className="flex items-center gap-2"
                      style={{ paddingLeft: `${depth * 1.5}rem` }}
                    >
                      {(() => {
                        const Icon =
                          (card.icon ? CARD_ICONS[card.icon] : undefined) ??
                          ACCOUNT_TYPE_ICONS[card.type ?? "other"];
                        return (
                          <Icon className="h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
                        );
                      })()}
                      <span>{card.title}</span>
                      {depth > 0 && (
                        <span className="rounded-full border border-blue-300 px-2 py-0.5 text-[10px] text-blue-600 dark:border-blue-800 dark:text-blue-300">
                          Linked card
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">{getAccountTypeLabel(card.type)}</td>
                  <td className="px-6 py-4">{card.type === "credit" ? card.billingDate : "—"}</td>
                  <td className="px-6 py-4">{card.type === "credit" ? card.paymentDate : "—"}</td>
                  <td className="px-6 py-4">
                    {formatMoney(
                      convertCurrency(card.totalLimit ?? 0, card.currency, displayCurrency),
                      displayCurrency,
                    )}
                  </td>
                  <td className="px-6 py-4 text-emerald-400 font-medium">
                    {formatMoney(
                      convertCurrency(currentBalance, card.currency, displayCurrency),
                      displayCurrency,
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {utilization === null ? (
                      "—"
                    ) : (
                      <div className="min-w-28">
                        <div className="flex justify-between gap-2 text-xs text-slate-500">
                          <span>{utilization.toFixed(0)}%</span>
                          <span>
                            {formatMoney(
                              convertCurrency(
                                Math.max(0, card.totalLimit - currentBalance),
                                card.currency,
                                displayCurrency,
                              ),
                              displayCurrency,
                            )}{" "}
                            available
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                          <div
                            className={`h-full rounded-full ${utilization > 80 ? "bg-rose-500" : utilization > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(100, utilization)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {card.type === "credit"
                      ? formatMoney(
                          convertCurrency(card.amc ?? 0, card.currency, displayCurrency),
                          displayCurrency,
                        )
                      : "—"}
                  </td>
                  <td className="px-6 py-4">
                    {card.type === "credit"
                      ? formatMoney(
                          convertCurrency(card.waiveOffLimit ?? 0, card.currency, displayCurrency),
                          displayCurrency,
                        )
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
            {displayCards.length === 0 && (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                  {cards?.length ? "No accounts match your search." : "No accounts found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <PaginationControls
        page={page}
        totalItems={displayCards.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />

      <AddCardModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialCard={cardToEdit}
      />
    </div>
  );
}
