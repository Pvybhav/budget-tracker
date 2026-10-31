import { afterEach, describe, expect, it, vi } from "vitest";
import type { Category, Expense } from "../db/db";
import {
  getBudgetStatus,
  getCategoryBudgetAlert,
  getEffectiveMonthlyBudget,
} from "./budget.service";

afterEach(() => vi.useRealTimers());

describe("budget amounts and status", () => {
  it("normalizes monthly, quarterly, and yearly budgets", () => {
    expect(getEffectiveMonthlyBudget(1200, "monthly")).toBe(1200);
    expect(getEffectiveMonthlyBudget(1200, "quarterly")).toBe(400);
    expect(getEffectiveMonthlyBudget(1200, "yearly")).toBe(100);
  });

  it("reports on-track, near-limit, and over-budget status without invalid progress", () => {
    expect(getBudgetStatus(50, 100)).toMatchObject({
      remaining: 50,
      progressPercent: 50,
      progressClamped: 50,
      statusLabel: "On track",
    });
    expect(getBudgetStatus(80, 100)).toMatchObject({
      isNearLimit: true,
      statusLabel: "Near limit",
    });
    expect(getBudgetStatus(125, 100)).toMatchObject({
      remaining: -25,
      progressClamped: 100,
      isOverBudget: true,
      isNearLimit: false,
      statusLabel: "Over budget",
    });
    expect(getBudgetStatus(5, 0).progressPercent).toBe(0);
    expect(getBudgetStatus(-10, 100).progressClamped).toBe(-10);
  });
});

describe("category budget alerts", () => {
  const category: Category = {
    id: "food",
    title: "Food",
    budgetAmount: 1000,
    budgetMode: "monthly",
  };

  it("does not alert for unbudgeted categories or spending below the warning threshold", () => {
    expect(getCategoryBudgetAlert({ id: "none", title: "No budget" }, [])).toBeNull();
    expect(
      getCategoryBudgetAlert(category, [
        { categoryId: "food", amount: 500, date: new Date().toISOString() },
      ]),
    ).toBeNull();
  });

  it.each([
    ["monthly", "2025-08-03"],
    ["quarterly", "2025-07-03"],
    ["yearly", "2025-01-03"],
  ] as const)(
    "uses the current %s period when evaluating alert spend",
    (budgetMode, expenseDate) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-08-15T12:00:00"));
      const expenses: Expense[] = [
        { categoryId: "food", amount: 850, date: expenseDate },
        { categoryId: "food", amount: 500, date: "2024-08-03" },
        { categoryId: "other", amount: 5000, date: expenseDate },
      ];

      expect(getCategoryBudgetAlert({ ...category, budgetMode }, expenses)).toMatchObject({
        severity: "warning",
        message: "Food is nearing its limit",
      });
    },
  );

  it("reports overspending and formats the selected currency", () => {
    const alert = getCategoryBudgetAlert(
      { ...category, budgetAmount: 100 },
      [{ categoryId: "food", amount: 120, currency: "USD", date: new Date().toISOString() }],
      "INR",
    );
    expect(alert).toMatchObject({ severity: "danger", message: "Budget exceeded for Food" });
    expect(alert?.detail).toContain("₹");
  });
});
