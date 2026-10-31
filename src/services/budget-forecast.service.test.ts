import { afterEach, describe, expect, it, vi } from "vitest";
import type { Category, Expense } from "../db/db";
import {
  calculateDailySpendingPace,
  forecastAllCategoryBudgets,
  forecastCategoryBudget,
  getDangerousBudgets,
  getSpendingInCurrentPeriod,
} from "./budget-forecast.service";

afterEach(() => {
  vi.useRealTimers();
});

describe("daily spending pace", () => {
  it("uses the selected period boundaries when the current date is outside the period", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-08-15T12:00:00Z"));

    expect(calculateDailySpendingPace(1000, 2025, 0, "monthly")).toEqual({
      dailySpent: 1000,
      daysElapsed: 31,
      daysRemaining: 0,
      averageDaily: 1000 / 31,
    });
    expect(calculateDailySpendingPace(600, 2025, 0, "quarterly").daysElapsed).toBe(90);
    expect(calculateDailySpendingPace(0, 2025, 0, "yearly").averageDaily).toBe(0);
  });

  it("uses leap years and clamps future periods to their first day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));

    expect(calculateDailySpendingPace(366, 2024, 0, "yearly").daysRemaining).toBe(199);
    expect(calculateDailySpendingPace(100, 2025, 0, "monthly")).toMatchObject({
      daysElapsed: 1,
      daysRemaining: 30,
      averageDaily: 100,
    });
  });
});

describe("budget forecasts", () => {
  const categories: Category[] = [
    { id: "food", title: "Food", budgetAmount: 1000, budgetMode: "monthly" },
    { id: "annual", title: "Annual", budgetAmount: 12_000, budgetMode: "yearly" },
    { id: "unbudgeted", title: "Unbudgeted" },
  ];

  it("returns no forecast for a category without an active budget", () => {
    expect(forecastCategoryBudget(categories[2], [])).toBeNull();
    expect(forecastCategoryBudget({ ...categories[0], budgetAmount: 0 }, [])).toBeNull();
  });

  it("filters expenses by category and selected current period", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-08-15T12:00:00"));
    const expenses: Expense[] = [
      { categoryId: "food", amount: 100, currency: "INR", date: "2025-08-02" },
      { categoryId: "food", amount: 200, currency: "INR", date: "2025-07-02" },
      { categoryId: "annual", amount: 2, currency: "USD", date: "2025-03-02" },
      { categoryId: "other", amount: 500, currency: "INR", date: "2025-08-02" },
    ];

    expect(getSpendingInCurrentPeriod(expenses, "food")).toBe(100);
    expect(getSpendingInCurrentPeriod(expenses, undefined, "quarterly")).toBe(800);
    expect(getSpendingInCurrentPeriod(expenses, "annual", "yearly", "USD")).toBe(2);
  });

  it("sorts forecasts by risk and filters warning and danger budgets", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-08-15T12:00:00"));
    const expenses: Expense[] = [
      { categoryId: "food", amount: 1000, date: "2025-08-01" },
      { categoryId: "annual", amount: 10_000, date: "2025-01-01" },
    ];
    const forecasts = forecastAllCategoryBudgets(categories, expenses);

    expect(forecasts.map((forecast) => forecast.categoryId)).toEqual(["annual", "food"]);
    expect(forecasts[0].riskLevel).toBe("danger");
    expect(getDangerousBudgets(forecasts).map((forecast) => forecast.categoryId)).toEqual([
      "annual",
      "food",
    ]);
    expect(forecastAllCategoryBudgets([categories[2]], [])).toEqual([]);
  });
});
