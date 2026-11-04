import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Gift, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useBackendResource } from "../services/backendHooks";
import { fetchCards, fetchRewardPoints } from "../services/backend.service";
import { deleteRewardPoints } from "../services/backendSync";
import showConfirm from "./Confirm";
import { getRewardPointsSummary } from "../services/rewardPoints.service";
import type { Card, RewardPointsEntry } from "../db/db";
import AddRewardPointsModal from "./modals/AddRewardPointsModal";
import {
  convertCurrency,
  formatConverted,
  formatMoney,
  useDisplayCurrency,
} from "../services/currency.service";
import { formatDateOnly } from "../utils/date";
import Tooltip from "./Tooltip";

export default function RewardPointsSection() {
  const displayCurrency = useDisplayCurrency();
  const cards = useBackendResource(() => fetchCards(), []);
  const entries = useBackendResource(() => fetchRewardPoints(), []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeCard, setActiveCard] = useState<Card | undefined>();
  const [entryToEdit, setEntryToEdit] = useState<RewardPointsEntry | undefined>();
  const [expandedCardId, setExpandedCardId] = useState<string | undefined>();
  const [search, setSearch] = useState("");

  const cardsWithPoints = useMemo(
    () =>
      (cards ?? []).map((card) => {
        const cardEntries = (entries ?? []).filter((entry) => entry.cardId === card.id);
        return { card, entries: cardEntries, summary: getRewardPointsSummary(cardEntries) };
      }),
    [cards, entries],
  );
  const totalPoints = cardsWithPoints.reduce((sum, item) => sum + item.summary.balance, 0);
  const totalValue = cardsWithPoints.reduce(
    (sum, item) =>
      sum + convertCurrency(item.summary.totalValue, item.card.currency, displayCurrency),
    0,
  );
  const entryCount = cardsWithPoints.reduce((sum, item) => sum + item.entries.length, 0);
  const visibleCards = cardsWithPoints.filter(({ card, entries: cardEntries }) => {
    const query = search.trim().toLowerCase();
    return (
      !query ||
      card.title.toLowerCase().includes(query) ||
      cardEntries.some((entry) =>
        [entry.type, entry.note ?? "", entry.points.toString()]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
    );
  });

  const openAddModal = (card: Card) => {
    setActiveCard(card);
    setEntryToEdit(undefined);
    setIsModalOpen(true);
  };
  const openEditModal = (card: Card, entry: RewardPointsEntry) => {
    setActiveCard(card);
    setEntryToEdit(entry);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5 dark:from-amber-950/40 dark:via-slate-900 dark:to-orange-950/30 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              <Gift className="h-3.5 w-3.5" /> Rewards hub
            </div>
            <h2 className="text-2xl font-bold text-slate-950 dark:text-white sm:text-3xl">
              Make every point count
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              See your combined loyalty balance, estimated value, and upcoming expiries across your
              cards.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-2xl border border-white/80 bg-white/75 px-3 py-3 dark:border-slate-700 dark:bg-slate-900/70">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Programs
              </div>
              <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                {cardsWithPoints.length}
              </div>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/75 px-3 py-3 dark:border-slate-700 dark:bg-slate-900/70">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Points
              </div>
              <div className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-300">
                {totalPoints.toLocaleString("en-IN")}
              </div>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/75 px-3 py-3 dark:border-slate-700 dark:bg-slate-900/70">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Est. value
              </div>
              <div className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">
                {formatMoney(totalValue, displayCurrency)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {cardsWithPoints.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
          Add a card first to start tracking reward points.
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative block w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Find a card or reward entry"
                aria-label="Search rewards"
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {entryCount} recorded {entryCount === 1 ? "entry" : "entries"}
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {visibleCards.map(({ card, entries: cardEntries, summary }) => (
              <article
                key={card.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="border-b border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/40 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-300">
                        <Gift className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-slate-900 dark:text-slate-100">
                          {card.title}
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {cardEntries.length}{" "}
                          {cardEntries.length === 1 ? "activity" : "activities"}
                          {summary.nextExpiry
                            ? ` · Expires ${formatDateOnly(summary.nextExpiry)}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openAddModal(card)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                    >
                      <Plus className="h-4 w-4" /> Add points
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Available balance
                      </p>
                      <p className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-300">
                        {summary.balance.toLocaleString("en-IN")}{" "}
                        <span className="text-sm font-medium">pts</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Estimated value
                      </p>
                      <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300">
                        {formatConverted(summary.totalValue, card.currency, displayCurrency)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-4 sm:p-5">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCardId(expandedCardId === card.id ? undefined : card.id)
                    }
                    aria-expanded={expandedCardId === card.id}
                    className="flex w-full items-center justify-between text-sm font-semibold text-slate-700 hover:text-amber-700 dark:text-slate-300 dark:hover:text-amber-300"
                  >
                    {expandedCardId === card.id ? "Hide activity" : "View activity"}
                    {expandedCardId === card.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  {expandedCardId === card.id && (
                    <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                      {cardEntries.length === 0 ? (
                        <div className="text-sm text-slate-500">No entries yet.</div>
                      ) : (
                        cardEntries.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700 dark:bg-slate-950/60 dark:text-slate-300"
                          >
                            <div className="min-w-0">
                              <div className="font-medium capitalize text-slate-900 dark:text-slate-100">
                                {entry.type} · {entry.points.toLocaleString("en-IN")} pts
                              </div>
                              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                {formatDateOnly(entry.date)}
                                {entry.expiryDate
                                  ? ` · Expires ${formatDateOnly(entry.expiryDate)}`
                                  : ""}
                                {entry.note ? ` · ${entry.note}` : ""}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Tooltip content="Edit reward points entry">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(card, entry)}
                                  aria-label="Edit reward points entry"
                                  className="rounded-lg p-2 text-slate-500 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-300"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              </Tooltip>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!entry.id) return;
                                  const ok = await showConfirm("Delete this reward points entry?", {
                                    title: "Delete entry",
                                    confirmText: "Delete",
                                  });
                                  if (ok) await deleteRewardPoints(entry.id);
                                }}
                                aria-label="Delete reward points entry"
                                className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-500"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
            {visibleCards.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400 xl:col-span-2">
                No reward cards or entries match “{search}”.
              </div>
            )}
          </div>
        </>
      )}
      <AddRewardPointsModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setActiveCard(undefined);
          setEntryToEdit(undefined);
        }}
        card={activeCard}
        initialEntry={entryToEdit}
      />
    </div>
  );
}
