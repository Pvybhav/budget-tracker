import { describe, expect, it } from "vitest";
import type { Expense } from "../db/db";
import { getNextRecurringExpenseDue } from "./recurring.service";

describe("next recurring expense due date", () => {
  const template: Expense = {
    id: "monthly",
    amount: 100,
    date: "2025-01-31T09:00:00",
    recurringFrequency: "monthly",
  };

  it("returns null for non-recurring expenses", () => {
    expect(
      getNextRecurringExpenseDue({ ...template, recurringFrequency: undefined }, []),
    ).toBeNull();
  });

  it("advances from the latest matching instance and preserves the monthly anchor", () => {
    const due = getNextRecurringExpenseDue(template, [
      { id: "unrelated", recurringTemplateId: "other", amount: 1, date: "2025-12-01" },
      { id: "instance", recurringTemplateId: "monthly", amount: 100, date: "2025-02-28T09:00:00" },
    ]);

    expect(due?.getFullYear()).toBe(2025);
    expect(due?.getMonth()).toBe(2);
    expect(due?.getDate()).toBe(31);
  });

  it("supports weekly intervals, skipped occurrences, and end dates", () => {
    const weekly: Expense = {
      ...template,
      date: "2025-01-01T09:00:00",
      recurringFrequency: "weekly",
      recurringInterval: 2,
      skipNextDue: true,
    };
    const due = getNextRecurringExpenseDue(weekly, []);
    expect(due?.getDate()).toBe(29);
    expect(
      getNextRecurringExpenseDue({ ...weekly, recurringEndDate: "2025-01-20" }, []),
    ).toBeNull();
  });

  it("supports annual recurrences", () => {
    const due = getNextRecurringExpenseDue(
      {
        ...template,
        date: "2024-02-29T09:00:00",
        recurringFrequency: "yearly",
      },
      [],
    );

    expect(due?.getFullYear()).toBe(2025);
    expect(due?.getMonth()).toBe(1);
    expect(due?.getDate()).toBe(28);
  });
});
