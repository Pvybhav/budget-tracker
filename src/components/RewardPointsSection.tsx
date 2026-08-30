import { useMemo, useState } from "react";
import { Gift, Pencil, Plus, Trash2 } from "lucide-react";
import { useBackendResource } from "../services/backendHooks";
import { fetchCards, fetchRewardPoints } from "../services/backend.service";
import { deleteRewardPoints } from "../services/backendSync";
import showConfirm from "./Confirm";
import { getRewardPointsSummary } from "../services/rewardPoints.service";
import type { Card, RewardPointsEntry } from "../db/db";
import AddRewardPointsModal from "./modals/AddRewardPointsModal";
export default function RewardPointsSection() {
  const cards = useBackendResource(() => fetchCards(), []);
  const entries = useBackendResource(() => fetchRewardPoints(), []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeCard, setActiveCard] = useState<Card | undefined>();
  const [entryToEdit, setEntryToEdit] = useState<RewardPointsEntry | undefined>();
  const [expandedCardId, setExpandedCardId] = useState<number | undefined>();
  const cardsWithPoints = useMemo(() => {
    return (cards ?? []).map((card) => {
      const cardEntries = (entries ?? []).filter((e) => e.cardId === card.id);
      return { card, entries: cardEntries, summary: getRewardPointsSummary(cardEntries) };
    });
  }, [cards, entries]);
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
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      {" "}
      <div className="flex items-start justify-between gap-3 mb-5">
        {" "}
        <div>
          {" "}
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {" "}
            Reward Points{" "}
          </div>{" "}
          <div className="text-lg font-bold text-slate-100">
            {" "}
            Track points earned, redeemed, and their ₹ value{" "}
          </div>{" "}
        </div>{" "}
      </div>{" "}
      {cardsWithPoints.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-6 text-center text-sm text-slate-400">
          {" "}
          Add a card first to start tracking reward points.{" "}
        </div>
      ) : (
        <div className="space-y-3">
          {" "}
          {cardsWithPoints.map(({ card, entries: cardEntries, summary }) => (
            <div key={card.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              {" "}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {" "}
                <div className="flex items-center gap-2">
                  {" "}
                  <Gift className="h-4 w-4 text-amber-400" />{" "}
                  <div>
                    {" "}
                    <div className="font-semibold text-slate-100"> {card.title} </div>{" "}
                    <div className="text-sm text-slate-400">
                      {" "}
                      {summary.balance.toLocaleString("en-IN")} pts · ₹{" "}
                      {summary.totalValue.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      value{" "}
                      {summary.nextExpiry
                        ? ` · next expiry ${new Date(summary.nextExpiry).toLocaleDateString()}`
                        : ""}{" "}
                    </div>{" "}
                  </div>{" "}
                </div>{" "}
                <div className="flex items-center gap-2">
                  {" "}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCardId(expandedCardId === card.id ? undefined : card.id)
                    }
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:text-white"
                  >
                    {" "}
                    {expandedCardId === card.id ? "Hide" : "History"}{" "}
                  </button>{" "}
                  <button
                    type="button"
                    onClick={() => openAddModal(card)}
                    className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
                  >
                    {" "}
                    <Plus className="h-3.5 w-3.5" /> Add{" "}
                  </button>{" "}
                </div>{" "}
              </div>{" "}
              {expandedCardId === card.id && (
                <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
                  {" "}
                  {cardEntries.length === 0 ? (
                    <div className="text-sm text-slate-500"> No entries yet. </div>
                  ) : (
                    cardEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between text-sm text-slate-300"
                      >
                        {" "}
                        <div>
                          {" "}
                          <span className="capitalize">{entry.type}</span>{" "}
                          {entry.points.toLocaleString("en-IN")} pts on{" "}
                          {new Date(entry.date).toLocaleDateString()}{" "}
                          {entry.expiryDate
                            ? ` (expires ${new Date(entry.expiryDate).toLocaleDateString()})`
                            : ""}{" "}
                          {entry.note ? ` — ${entry.note}` : ""}{" "}
                        </div>{" "}
                        <button
                          type="button"
                          onClick={() => openEditModal(card, entry)}
                          className="text-slate-500 hover:text-amber-400"
                          title="Edit reward points entry"
                        >
                          {" "}
                          <Pencil className="h-3.5 w-3.5" />{" "}
                        </button>{" "}
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
                          className="text-slate-500 hover:text-rose-400"
                        >
                          {" "}
                          <Trash2 className="h-3.5 w-3.5" />{" "}
                        </button>{" "}
                      </div>
                    ))
                  )}{" "}
                </div>
              )}{" "}
            </div>
          ))}{" "}
        </div>
      )}{" "}
      <AddRewardPointsModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setActiveCard(undefined);
          setEntryToEdit(undefined);
        }}
        card={activeCard}
        initialEntry={entryToEdit}
      />{" "}
    </div>
  );
}
