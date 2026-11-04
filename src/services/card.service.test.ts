import { describe, expect, it } from "vitest";
import type { Card, Expense, Payment } from "../db/db";
import { getCardMetrics, getPaymentDebitForAccount } from "./card.service";

describe("card payment balances", () => {
  it("reduces the source account balance by converted card payments", () => {
    const bank: Card = {
      id: "bank",
      title: "Bank",
      type: "bank",
      totalLimit: 1000,
      currency: "USD",
    };
    const payments: Payment[] = [
      {
        cardId: "credit",
        sourceAccountId: "bank",
        amount: 8350,
        currency: "INR",
        date: "2026-11-03",
      },
      {
        cardId: "credit",
        amount: 100,
        currency: "USD",
        date: "2026-11-03",
      },
      {
        cardId: "other-bank",
        sourceAccountId: "other-bank",
        amount: 50,
        currency: "USD",
        date: "2026-11-03",
      },
    ];

    expect(getPaymentDebitForAccount(bank, payments)).toBeCloseTo(100);
  });

  it("reduces the paid card's remaining balance without removing recorded expenses", () => {
    const creditCard: Card = {
      id: "credit",
      title: "Credit",
      type: "credit",
      totalLimit: 1000,
      currency: "USD",
    };
    const expenses: Expense[] = [
      { cardId: "credit", amount: 500, date: "2026-11-03", currency: "USD" },
    ];
    const payments: Payment[] = [
      {
        cardId: "credit",
        sourceAccountId: "bank",
        amount: 150,
        date: "2026-11-03",
        currency: "USD",
      },
    ];

    const metrics = getCardMetrics(creditCard, expenses, payments);

    expect(metrics.totalSpent).toBe(500);
    expect(metrics.amountOwed).toBe(350);
  });
});
