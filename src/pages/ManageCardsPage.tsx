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
import SortableTableHeader from "../components/SortableTableHeader";
import { useTableSort } from "../components/useTableSort";
import CardThumbnail from "../components/CardThumbnail";
import {
  ArrowDownUp,
  Banknote,
  CreditCard,
  LayoutGrid,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  WalletCards,
} from "lucide-react";

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
  const [typeFilter, setTypeFilter] = useState<"all" | Card["type"]>("all");
  const [healthFilter, setHealthFilter] = useState<"all" | "healthy" | "attention">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const { sortKey, direction, toggleSort, setSort, sortRows } = useTableSort<{
    card: Card;
    depth: number;
  }>("title", "asc");
  const pageSize = 50;
  const query = search.trim().toLowerCase();
  const matchingCards = useMemo(() => {
    return (cards ?? []).filter(
      (card) =>
        !query ||
        card.title.toLowerCase().includes(query) ||
        getAccountTypeLabel(card.type).toLowerCase().includes(query) ||
        card.bankName?.toLowerCase().includes(query),
    );
  }, [cards, query]);
  const filteredCards = useMemo(() => {
    return matchingCards.filter((card) => {
      if (typeFilter !== "all" && card.type !== typeFilter) return false;
      if (healthFilter === "all") return true;
      if (card.type !== "credit") return false;
      const cardExpenses = (expenses ?? []).filter((expense) => expense.cardId === card.id);
      const cardPayments = (payments ?? []).filter((payment) => payment.cardId === card.id);
      const metrics = getCardMetrics(card, cardExpenses, cardPayments, cards ?? []);
      const utilization = getCreditUtilization(card.totalLimit ?? 0, metrics.currentBalance);
      if (utilization === null) return healthFilter === "healthy";
      return healthFilter === "healthy" ? utilization <= 80 : utilization > 80;
    });
  }, [cards, expenses, healthFilter, matchingCards, payments, typeFilter]);
  const displayCards = useMemo(() => {
    if (accountView === "flat") return filteredCards.map((card) => ({ card, depth: 0 }));

    const allCards = cards ?? [];
    const cardsById = new Map(allCards.map((card) => [card.id ?? "", card]));
    const includedIds = new Set(filteredCards.map((card) => card.id ?? ""));
    for (const card of filteredCards) {
      let parentId = card.linkedCardIds?.[0];
      const ancestors = new Set<string>();
      while (parentId && !ancestors.has(parentId)) {
        ancestors.add(parentId);
        includedIds.add(parentId);
        parentId = cardsById.get(parentId)?.linkedCardIds?.[0];
      }
    }

    const childrenByParent = new Map<string, Card[]>();
    for (const card of allCards) {
      const parentId = card.linkedCardIds?.[0];
      if (!parentId || parentId === card.id) continue;
      const children = childrenByParent.get(parentId) ?? [];
      children.push(card);
      childrenByParent.set(parentId, children);
    }
    const ordered: { card: Card; depth: number }[] = [];
    const visited = new Set<string>();
    const addBranch = (card: Card, depth: number) => {
      const id = card.id ?? "";
      if (!includedIds.has(id) || visited.has(id)) return;
      visited.add(id);
      ordered.push({ card, depth });
      for (const child of childrenByParent.get(id) ?? []) addBranch(child, depth + 1);
    };
    for (const card of allCards) {
      const parentId = card.linkedCardIds?.[0];
      if (!parentId || !cardsById.has(parentId)) addBranch(card, 0);
    }
    for (const card of allCards) addBranch(card, 0);
    return ordered;
  }, [cards, filteredCards, accountView]);
  const tableCards =
    accountView === "flat"
      ? sortRows(displayCards, {
          title: ({ card }) => card.title,
          type: ({ card }) => getAccountTypeLabel(card.type),
          billingDate: ({ card }) => card.billingDate ?? 0,
          paymentDate: ({ card }) => card.paymentDate ?? 0,
          limit: ({ card }) =>
            convertCurrency(card.totalLimit ?? 0, card.currency, displayCurrency),
          balance: ({ card }) => {
            const metrics = getCardMetrics(
              card,
              (expenses ?? []).filter((expense) => expense.cardId === card.id),
              (payments ?? []).filter((payment) => payment.cardId === card.id),
              cards ?? [],
            );
            const accountIncome = (incomes ?? [])
              .filter((income) => income.accountId === card.id)
              .reduce((sum, income) => sum + income.amount, 0);
            const transferIn = (transfers ?? [])
              .filter((transfer) => transfer.toAccountId === card.id)
              .reduce((sum, transfer) => sum + transfer.amount, 0);
            const transferOut = (transfers ?? [])
              .filter((transfer) => transfer.fromAccountId === card.id)
              .reduce((sum, transfer) => sum + transfer.amount, 0);
            const balance =
              card.type === "credit"
                ? metrics.currentBalance
                : metrics.currentBalance + accountIncome + transferIn - transferOut;
            return convertCurrency(balance, card.currency, displayCurrency);
          },
          utilization: ({ card }) => {
            if (card.type !== "credit") return -1;
            const metrics = getCardMetrics(
              card,
              (expenses ?? []).filter((expense) => expense.cardId === card.id),
              (payments ?? []).filter((payment) => payment.cardId === card.id),
              cards ?? [],
            );
            return getCreditUtilization(card.totalLimit ?? 0, metrics.currentBalance);
          },
          amc: ({ card }) => card.amc ?? 0,
          waiverLimit: ({ card }) => card.waiveOffLimit ?? 0,
        })
      : displayCards;
  const visibleCards = tableCards.slice((page - 1) * pageSize, page * pageSize);
  const creditCards = cards?.filter((card) => card.type === "credit") ?? [];
  const attentionCards = creditCards.filter((card) => {
    const metrics = getCardMetrics(
      card,
      (expenses ?? []).filter((expense) => expense.cardId === card.id),
      (payments ?? []).filter((payment) => payment.cardId === card.id),
      cards ?? [],
    );
    const utilization = getCreditUtilization(card.totalLimit ?? 0, metrics.currentBalance);
    return utilization !== null && utilization > 80;
  });
  const totalLimit = creditCards.reduce(
    (sum, card) => sum + convertCurrency(card.totalLimit ?? 0, card.currency, displayCurrency),
    0,
  );

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
  const handleCardSort = (key: string) => {
    if (accountView === "hierarchy") setSort(key, "asc");
    else toggleSort(key);
    setAccountView("flat");
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-xl dark:border-slate-800 md:p-8">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-300">
              Your financial hub
            </p>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Accounts & cards</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              Keep every card, wallet, and bank account organized in one clear view.
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-blue-50"
          >
            <Plus className="h-4 w-4" />
            Add account
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total accounts",
            value: cards?.length ?? 0,
            detail: `${creditCards.length} credit accounts`,
            icon: WalletCards,
            color: "text-blue-500 bg-blue-500/10",
          },
          {
            label: "Credit limit",
            value: formatMoney(totalLimit, displayCurrency),
            detail: "Across all credit cards",
            icon: CreditCard,
            color: "text-violet-500 bg-violet-500/10",
          },
          {
            label: "Needs attention",
            value: attentionCards.length,
            detail: attentionCards.length ? "Above 80% utilization" : "Everything looks healthy",
            icon: SlidersHorizontal,
            color: attentionCards.length
              ? "text-rose-500 bg-rose-500/10"
              : "text-emerald-500 bg-emerald-500/10",
          },
          {
            label: "Linked accounts",
            value: cards?.filter((card) => card.linkedCardIds?.length).length ?? 0,
            detail: "Sharing a master account",
            icon: Banknote,
            color: "text-amber-500 bg-amber-500/10",
          },
        ].map(({ label, value, detail, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {value}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
              </div>
              <span className={`rounded-xl p-2.5 ${color}`}>
                <Icon className="h-5 w-5" />
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search accounts, banks, or types"
              aria-label="Search accounts"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value as typeof typeFilter);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            aria-label="Filter by account type"
          >
            <option value="all">All account types</option>
            <option value="credit">Credit cards</option>
            <option value="debit">Debit cards</option>
            <option value="bank">Bank accounts</option>
            <option value="wallet">UPI wallets</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
          <select
            value={healthFilter}
            onChange={(event) => {
              setHealthFilter(event.target.value as typeof healthFilter);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            aria-label="Filter by credit utilization"
          >
            <option value="all">All utilization</option>
            <option value="healthy">Healthy utilization</option>
            <option value="attention">Needs attention</option>
          </select>
          <div className="flex rounded-xl border border-slate-200 p-1 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`rounded-lg p-2 ${viewMode === "grid" ? "bg-blue-600 text-white" : "text-slate-500"}`}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`rounded-lg p-2 ${viewMode === "list" ? "bg-blue-600 text-white" : "text-slate-500"}`}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <ArrowDownUp className="h-3.5 w-3.5" />
            <span>{displayCards.length} accounts shown</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <button
              type="button"
              onClick={() => {
                setAccountView(accountView === "hierarchy" ? "flat" : "hierarchy");
                setPage(1);
              }}
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              {accountView === "hierarchy" ? "Show flat list" : "Show hierarchy"}
            </button>
          </div>
          {(search || typeFilter !== "all" || healthFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setTypeFilter("all");
                setHealthFilter("all");
                setPage(1);
              }}
              className="text-xs font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
      {viewMode === "grid" ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleCards.map(({ card }) => (
            <div key={card.id} className="group">
              <CardThumbnail card={card} />
              <div className="flex items-center justify-between rounded-b-2xl border border-t-0 border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {getAccountTypeLabel(card.type)}
                </span>
                <div className="flex gap-3 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => openEditModal(card)}
                    className="text-blue-600 hover:text-blue-500 dark:text-blue-400"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(card)}
                    className="text-rose-500 hover:text-rose-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {displayCards.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 px-6 py-14 text-center text-sm text-slate-500 dark:border-slate-700">
              {cards?.length
                ? "No accounts match your filters."
                : "No accounts found. Add your first account to get started."}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-slate-700 dark:text-slate-300 whitespace-nowrap min-w-max">
            <thead className="bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <SortableTableHeader
                  label="Title"
                  sortKey="title"
                  activeKey={accountView === "flat" ? sortKey : ""}
                  direction={direction}
                  onSort={handleCardSort}
                  className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100"
                />
                <SortableTableHeader
                  label="Type"
                  sortKey="type"
                  activeKey={accountView === "flat" ? sortKey : ""}
                  direction={direction}
                  onSort={handleCardSort}
                  className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100"
                />
                <SortableTableHeader
                  label="Billing Date"
                  sortKey="billingDate"
                  activeKey={accountView === "flat" ? sortKey : ""}
                  direction={direction}
                  onSort={handleCardSort}
                  className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100"
                />
                <SortableTableHeader
                  label="Payment Date"
                  sortKey="paymentDate"
                  activeKey={accountView === "flat" ? sortKey : ""}
                  direction={direction}
                  onSort={handleCardSort}
                  className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100"
                />
                <SortableTableHeader
                  label="Limit / Balance"
                  sortKey="limit"
                  activeKey={accountView === "flat" ? sortKey : ""}
                  direction={direction}
                  onSort={handleCardSort}
                  className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100"
                />
                <SortableTableHeader
                  label="Current Balance"
                  sortKey="balance"
                  activeKey={accountView === "flat" ? sortKey : ""}
                  direction={direction}
                  onSort={handleCardSort}
                  className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100"
                />
                <SortableTableHeader
                  label="Utilization"
                  sortKey="utilization"
                  activeKey={accountView === "flat" ? sortKey : ""}
                  direction={direction}
                  onSort={handleCardSort}
                  className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100"
                />
                <SortableTableHeader
                  label="AMC"
                  sortKey="amc"
                  activeKey={accountView === "flat" ? sortKey : ""}
                  direction={direction}
                  onSort={handleCardSort}
                  className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100"
                />
                <SortableTableHeader
                  label="Waiver Limit"
                  sortKey="waiverLimit"
                  activeKey={accountView === "flat" ? sortKey : ""}
                  direction={direction}
                  onSort={handleCardSort}
                  className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100"
                />
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
                              )}
                              available
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                            <div
                              className={`progress-fill h-full rounded-full ${utilization > 80 ? "bg-rose-500" : utilization > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
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
                            convertCurrency(
                              card.waiveOffLimit ?? 0,
                              card.currency,
                              displayCurrency,
                            ),
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
      )}
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
