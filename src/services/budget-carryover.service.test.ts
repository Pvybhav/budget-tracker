import { describe, expect, it } from "vitest";
import type { Category } from "../db/db";
import {
  calculateCategoryCarryovers,
  calculateMonthlyCarryover,
  getEffectiveBudgetWithCarryover,
} from "./budget-carryover.service";

describe("budget carryover", () => {
  const category: Category = {
    id: "food",
    title: "Food",
    budgetAmount: 12_000,
    budgetMode: "yearly",
    enableCarryover: true,
  };

  it("carries unused budget forward up to the configured cap", () => {
    expect(calculateMonthlyCarryover({ ...category, maxCarryoverLimit: 500 }, 300)).toMatchObject({
      previousMonthBudget: 1000,
      carryoverAmount: 700,
      actualCarryover: 500,
      currentMonthEffectiveBudget: 1500,
    });
    expect(calculateMonthlyCarryover(category, 300).actualCarryover).toBe(700);
  });

  it("does not carry over overspending or disabled budgets", () => {
    expect(calculateMonthlyCarryover(category, 1500).actualCarryover).toBe(0);
    expect(calculateMonthlyCarryover({ ...category, enableCarryover: false }, 0)).toMatchObject({
      actualCarryover: 0,
      note: "Carryover not enabled for this category",
    });
    expect(
      calculateMonthlyCarryover({ id: "other", title: "Other" }, 0).currentMonthEffectiveBudget,
    ).toBe(0);
  });

  it("calculates a collection using per-category spend and adds carryover to the base budget", () => {
    const results = calculateCategoryCarryovers(
      [category, { id: "other", title: "Other" }],
      new Map([["food", 400]]),
    );
    expect(results.map((result) => result.actualCarryover)).toEqual([600, 0]);
    expect(getEffectiveBudgetWithCarryover(1000, 600)).toBe(1600);
  });
});
