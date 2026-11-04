import { describe, expect, it } from "vitest";
import type { Category, Expense } from "../db/db";
import { getMonthlySpending } from "./budget-comparison.service";

describe("monthly spending comparison", () => {
  const categories: Category[] = [{ id: "food", title: "Food" }];

  it("includes expenses from the final day of a month", () => {
    const expenses: Expense[] = [
      { amount: 25, date: "2026-10-31T23:59:00", categoryId: "food", currency: "INR" },
    ];

    const result = getMonthlySpending(expenses, 2026, 9, categories, "INR");

    expect(result.totalSpending).toBe(25);
    expect(result.categoryBreakdown).toEqual([
      { categoryId: "food", categoryTitle: "Food", amount: 25 },
    ]);
  });

  it("counts an EMI installment in each applicable month, not the full purchase", () => {
    const expenses: Expense[] = [
      {
        amount: 1200,
        date: "2026-09-10",
        emiStartDate: "2026-09-10",
        emiMonths: 3,
        isEmi: true,
        categoryId: "food",
        currency: "INR",
      },
    ];

    const september = getMonthlySpending(expenses, 2026, 8, categories, "INR");
    const october = getMonthlySpending(expenses, 2026, 9, categories, "INR");
    const december = getMonthlySpending(expenses, 2026, 11, categories, "INR");

    expect(september.totalSpending).toBeCloseTo(400);
    expect(october.totalSpending).toBeCloseTo(400);
    expect(december.totalSpending).toBe(0);
    expect(october.categoryBreakdown[0]?.amount).toBeCloseTo(400);
  });
});
