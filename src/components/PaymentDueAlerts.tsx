import { useMemo } from "react";
import { useBackendResource } from "../services/backendHooks";
import { type Card } from "../db/db";
import { getCardMetrics } from "../services/card.service";
import { createPayment } from "../services/backendSync";
import { fetchCards, fetchExpenses, fetchPayments } from "../services/backend.service";
import showConfirm, { showAlert } from "./Confirm";

function daysBetween(a: Date, b: Date) {
  const diff = a.getTime() - b.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

interface DueItem {
  card: Card;
  metrics: ReturnType<typeof getCardMetrics>;
  daysUntil: number;
}

export default function PaymentDueAlerts({ days = 7 }: { days?: number }) {
  const cards = useBackendResource(() => fetchCards(), []);
  const expenses = useBackendResource(() => fetchExpenses(), []);
  const payments = useBackendResource(() => fetchPayments(), []);

  const dueItems = useMemo(() => {
    if (!cards || !expenses || !payments) return [] as DueItem[];

    const today = new Date();

    return cards
      .filter((c) => c.type === "credit")
      .map((card) => {
        const cardExpenses = expenses.filter((e) => e.cardId === card.id);
        const cardPayments = payments.filter((p) => p.cardId === card.id);
        const metrics = getCardMetrics(card as Card, cardExpenses, cardPayments, cards);
        return {
          card,
          metrics,
          daysUntil: daysBetween(metrics.nextPayDate, today),
        };
      })
      .filter((it) => it.metrics.amountToPayNext > 0 && it.daysUntil >= 0 && it.daysUntil <= days);
  }, [cards, expenses, payments, days]);

  if (!cards) return null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Payment Alerts
          </div>
          <div className="text-sm font-bold text-slate-100">Upcoming payments due</div>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {dueItems.length === 0 && (
          <div className="text-sm text-slate-400">No payments due in the next {days} days.</div>
        )}

        {dueItems.map(({ card, metrics, daysUntil }) => (
          <div
            key={card.id}
            className="flex items-center justify-between bg-slate-800/40 p-3 rounded-lg"
          >
            <div>
              <div className="text-sm font-semibold text-slate-100">{card.title}</div>
              <div className="text-xs text-slate-400">
                Due in {daysUntil} day{daysUntil !== 1 ? "s" : ""} • ₹
                {metrics.amountToPayNext.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const ok = await showConfirm(
                    `Mark ₹${metrics.amountToPayNext.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} as paid for ${card.title}?`,
                    { title: "Mark Paid", confirmText: "Mark Paid" },
                  );
                  if (!ok) return;
                  await createPayment({
                    cardId: card.id!,
                    date: new Date().toISOString(),
                    amount: metrics.amountToPayNext,
                  });
                  await showAlert("Payment recorded.");
                }}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
              >
                Mark Paid
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
