import { describe, expect, it } from "@jest/globals";
import {
  calcMonthlyEmi,
  calculateBudgetCarryover,
  calculateInvestmentReturn,
  calculateNetWorth,
  compareMonthlySpending,
  convertCurrency,
  forecastBudget,
  getEmiSchedule,
  getInsuranceSummary,
  getMonthlyExpenseAmount,
  getNextRecurringDue,
} from "../calculations";

describe("currency conversion", () => {
  it("keeps the original amount when the currencies match", () => {
    expect(convertCurrency(125, "INR", "INR")).toBe(125);
  });

  it("converts through the shared USD rate table", () => {
    expect(convertCurrency(83.5, "INR", "USD")).toBeCloseTo(1);
    expect(convertCurrency(1, "USD", "EUR")).toBeCloseTo(0.92);
  });
});

describe("recurring records", () => {
  it.each([
    ["weekly", "2025-01-08"],
    ["monthly", "2025-02-01"],
    ["yearly", "2026-01-01"],
  ] as const)("calculates the next %s occurrence", (recurringFrequency, expected) => {
    expect(getNextRecurringDue(
      { date: "2025-01-01", recurringFrequency },
      new Date("2025-01-07T00:00:00Z"),
    )).toBe(expected);
  });

  it("respects recurring intervals and end dates", () => {
    expect(getNextRecurringDue(
      { date: "2025-01-01", recurringFrequency: "weekly", recurringInterval: 2 },
      new Date("2025-01-08T00:00:00Z"),
    )).toBe("2025-01-15");
    expect(getNextRecurringDue(
      { date: "2025-01-01", recurringFrequency: "monthly", recurringEndDate: "2025-02-01" },
      new Date("2025-01-31T00:00:00Z"),
    )).toBe("2025-02-01");
    expect(getNextRecurringDue(
      { date: "2025-01-01", recurringFrequency: "monthly", recurringEndDate: "2025-01-31" },
      new Date("2025-01-31T00:00:00Z"),
    )).toBeNull();
    expect(getNextRecurringDue({ date: "2025-01-01" })).toBeNull();
  });

  it("keeps month-end recurring dates aligned across short months", () => {
    expect(getNextRecurringDue(
      { date: "2025-01-31", recurringFrequency: "monthly" },
      new Date("2025-02-01T12:00:00Z"),
    )).toBe("2025-02-28");
    expect(getNextRecurringDue(
      { date: "2025-01-31", recurringFrequency: "monthly" },
      new Date("2025-02-28T12:00:00Z"),
    )).toBe("2025-03-31");
  });
});

describe("financial summaries", () => {
  it("calculates budget carryover without allowing negative balances", () => {
    expect(calculateBudgetCarryover(1000, 650, 200)).toBe(550);
    expect(calculateBudgetCarryover(1000, 1200)).toBe(0);
  });

  it("calculates net worth and investment gains", () => {
    expect(calculateNetWorth(250_000, 75_000)).toBe(175_000);
    expect(calculateInvestmentReturn(1000, 1250)).toEqual({ profit: 250, percentage: 25 });
    expect(calculateInvestmentReturn(0, 100)).toEqual({ profit: 100, percentage: 0 });
  });

  it("summarizes insurance due dates and expired policies", () => {
    const policy = {
      startDate: "2025-01-01",
      premiumFrequency: "quarterly" as const,
      premiumPayments: [
        { amount: 100, date: "2025-01-01" },
        { amount: 125, date: "2025-04-01" },
      ],
    };
    expect(getInsuranceSummary(policy, new Date("2025-04-20T12:00:00Z"))).toMatchObject({
      nextDueDate: "2025-07-01",
      totalPaid: 225,
      status: "ok",
    });
    expect(getInsuranceSummary(
      { ...policy, endDate: "2025-04-10" },
      new Date("2025-04-20T12:00:00Z"),
    ).status).toBe("expired");
    expect(getInsuranceSummary(
      { ...policy, startDate: "2025-04-01", premiumPayments: [] },
      new Date("2025-04-01T12:00:00Z"),
    ).status).toBe("due");
  });

  it("clamps monthly premium dates to month end without drifting", () => {
    const summary = getInsuranceSummary({
      startDate: "2025-01-31",
      premiumFrequency: "monthly",
      premiumPayments: [{ amount: 100, date: "2025-01-31" }],
    }, new Date("2025-02-01T12:00:00Z"));
    expect(summary.nextDueDate).toBe("2025-02-28");
    expect(summary.daysUntilDue).toBe(27);
  });
});

describe("EMI calculations", () => {
  it("supports zero-interest, interest-bearing, and invalid terms", () => {
    expect(calcMonthlyEmi(1200, 0, 12)).toBe(100);
    expect(calcMonthlyEmi(100_000, 12, 12)).toBeCloseTo(8884.88, 1);
    expect(calcMonthlyEmi(1000, 12, 0)).toBe(0);
  });

  it("includes fees in monthly spending only during the EMI term", () => {
    const expense = {
      amount: 1200,
      date: "2025-01-01",
      isEmi: true,
      emiMonths: 12,
      emiProcessingFee: 120,
      emiGst: 18,
    };
    expect(getMonthlyExpenseAmount(expense, new Date("2025-06-01T00:00:00Z"))).toBe(111.5);
    expect(getMonthlyExpenseAmount(expense, new Date("2024-12-01T00:00:00Z"))).toBe(0);
    expect(getMonthlyExpenseAmount(expense, new Date("2026-01-01T00:00:00Z"))).toBe(0);
  });

  it("builds a balanced installment schedule with a final adjustment", () => {
    const schedule = getEmiSchedule(1000, 0, 3, "2099-01-01");
    expect(schedule).toHaveLength(3);
    expect(schedule.map((entry) => entry.paymentNumber)).toEqual([1, 2, 3]);
    expect(schedule[0].status).toBe("upcoming");
    expect(schedule.reduce((sum, entry) => sum + entry.principalAmount, 0)).toBeCloseTo(1000);
    expect(schedule.at(-1)?.remainingBalance).toBe(0);
  });

  it("keeps installment dates on the original day after short months", () => {
    const schedule = getEmiSchedule(1000, 0, 3, "2099-01-31");
    expect(schedule.map((entry) => entry.dueDate)).toEqual([
      "2099-01-31",
      "2099-02-28",
      "2099-03-31",
    ]);
  });
});

describe("budgets and monthly comparisons", () => {
  it("normalizes quarter and annual budgets into monthly limits", () => {
    const currentDate = new Date();
    const currentMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
    expect(forecastBudget(
      { title: "Food", budgetAmount: 3000, budgetMode: "quarterly" },
      [{ category: "Food", date: currentMonthDate, amount: 300 }],
    ).limit).toBe(1000);
    expect(forecastBudget(
      { title: "Food", budgetAmount: 12_000, budgetMode: "yearly" },
      [],
    ).limit).toBe(1000);
  });

  it("flags an over-budget projection and compares this month to last month", () => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const expenses = [
      { category: "Food", date: thisMonth, amount: 10_000 },
      { category: "Food", date: lastMonth, amount: 5000 },
    ];
    expect(forecastBudget({ title: "Food", budgetAmount: 100, budgetMode: "monthly" }, expenses).willExceed).toBe(true);
    const comparison = compareMonthlySpending(expenses);
    expect(comparison.current).toBe(10_000);
    expect(comparison.previous).toBe(5000);
    expect(comparison.changePercent).toBe(100);
  });
});
