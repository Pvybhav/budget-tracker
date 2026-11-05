import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  applyPendingMutations,
  buildAlerts,
  createLocalId,
  hydrateModules,
  initialModules,
  modulePayload,
  moduleResource,
  snapshotAccounts,
  snapshotExpenses,
  snapshotGoals,
} from "../app-data";
import type { PendingMutation } from "../api";
import { initialExpenses, initialGoals } from "../components/constants";
import type { Expense, ModuleKey } from "../components/types";

function mutation(overrides: Partial<PendingMutation>): PendingMutation {
  return {
    id: "mutation",
    username: "alex",
    resource: "expenses",
    operation: "create",
    recordId: "local-1",
    collection: "expenses",
    createdAt: 1,
    ...overrides,
  };
}

describe("snapshot hydration", () => {
  it("uses safe defaults for missing and non-array resources", () => {
    expect(snapshotExpenses({ expenses: "invalid" })).toEqual([]);
    expect(snapshotGoals({ "savings-goals": null })).toEqual([]);
    expect(snapshotAccounts({ cards: {} })).toEqual([]);
    expect(hydrateModules(initialModules, { bills: null }).bills).toEqual(initialModules.bills);
  });

  it("normalizes snapshot records and rotates goal colors", () => {
    expect(snapshotExpenses({
      expenses: [
        { id: "e1", details: "Coffee", categoryId: "food", amount: "12.5", date: "2026-01-03", isEmi: true, emiMonths: 3 },
        { _id: "e2", details: 4, categoryId: null, amount: 0, date: null, emiMonths: "2" },
        null,
      ],
    })).toEqual([
      { id: "e1", title: "Coffee", category: "food", amount: 12.5, date: "2026-01-03", isEmi: true, months: 3 },
      { id: "e2", title: "Expense", category: "Uncategorized", amount: 0, date: "", isEmi: false, months: undefined },
      { id: "", title: "Expense", category: "Uncategorized", amount: 0, date: "", isEmi: false, months: undefined },
    ]);
    expect(snapshotGoals({
      "savings-goals": [
        { id: "g1", title: "Trip", targetAmount: "1000", currentAmount: 250 },
        { _id: "g2" },
        {},
        {},
      ],
    })).toEqual([
      { id: "g1", title: "Trip", target: 1000, saved: 250, color: "#0f766e" },
      { id: "g2", title: "Savings goal", target: 0, saved: 0, color: "#2563eb" },
      { id: "", title: "Savings goal", target: 0, saved: 0, color: "#c27a2c" },
      { id: "", title: "Savings goal", target: 0, saved: 0, color: "#0f766e" },
    ]);
    expect(snapshotAccounts({ cards: [{ id: "c1", title: "Card" }, { _id: "c2" }, {}, null] })).toEqual([
      { id: "c1", title: "Card" },
      { id: "c2", title: "Account" },
    ]);
  });

  it("hydrates mapped module collections with field and status fallbacks", () => {
    const result = hydrateModules(initialModules, {
      bills: [
        { id: "b-1", name: "Power", note: "Tomorrow", amount: "500", status: "Overdue", enabled: true },
        { _id: "b-2", title: "Internet", provider: "Fiber", currentValue: "90", enabled: false },
        { source: "Imported bill", thresholdAmount: 22 },
        null,
      ],
      payments: [{ id: "p1", title: "Card", amount: 30 }],
      transfers: [{ id: "t1", source: "Checking", amount: 40 }],
      income: [{ id: "i1", source: "Salary", amount: 100 }],
      loans: [{ id: "l1", title: "Loan" }],
      insurance: [{ id: "ins1", provider: "Insurer" }],
      "budget-rules": [{ id: "bu1", name: "Food", thresholdAmount: 200 }],
      categories: [{ id: "c1", title: "Food" }],
      investments: [{ id: "iv1", currentValue: 400 }],
      "reward-points": [{ id: "r1", amount: 5 }],
      "net-worth-snapshots": [{ id: "nw1", currentValue: 700 }],
    });
    expect(result.bills).toEqual([
      { id: "b-1", title: "Power", detail: "Tomorrow", amount: 500, status: "Overdue", enabled: true },
      { id: "b-2", title: "Internet", detail: "Fiber", amount: 90, status: "Disabled", enabled: false },
      { id: "bills-2", title: "Imported bill", detail: "Synced from Budget Tracker", amount: 22, status: "Active", enabled: true },
      { id: "bills-3", title: "Bills & subscriptions", detail: "Synced from Budget Tracker", amount: 0, status: "Active", enabled: true },
    ]);
    expect(result.payments[0].title).toBe("Card");
    expect(result.transfers[0].title).toBe("Checking");
    expect(result.income[0].title).toBe("Salary");
    expect(result.loans[0].amount).toBe(0);
    expect(result.insurance[0].detail).toBe("Insurer");
    expect(result.budgets[0].amount).toBe(200);
    expect(result.categories[0].title).toBe("Food");
    expect(result.investments[0].amount).toBe(400);
    expect(result.rewards[0].amount).toBe(5);
    expect(result.netWorth[0].amount).toBe(700);
    expect(result.subscriptions).toEqual(initialModules.subscriptions);
  });
});

describe("pending offline mutations", () => {
  it("applies create, update, and delete entries to expenses, goals, and modules", () => {
    const replacementExpense: Expense = { id: "e1", title: "Updated", category: "Food", amount: 20, date: "today" };
    const addedExpense: Expense = { id: "e-new", title: "New", category: "Food", amount: 30, date: "today" };
    const updatedGoal = { ...initialGoals[0], title: "Updated goal" };
    const addedBill = { id: "b-new", title: "New bill", detail: "Soon" };
    const result = applyPendingMutations(initialExpenses, initialGoals, initialModules, [
      mutation({ collection: "expenses", operation: "update", recordId: "1", optimisticRecord: replacementExpense }),
      mutation({ collection: "expenses", operation: "create", recordId: "e-new", optimisticRecord: addedExpense }),
      mutation({ collection: "expenses", operation: "delete", recordId: "2" }),
      mutation({ collection: "goals", operation: "update", recordId: "1", optimisticRecord: updatedGoal }),
      mutation({ collection: "goals", operation: "create", recordId: "g-new", optimisticRecord: { ...initialGoals[0], id: "g-new" } }),
      mutation({ collection: "goals", operation: "delete", recordId: "2" }),
      mutation({ collection: "bills", operation: "update", recordId: "b1", optimisticRecord: addedBill }),
      mutation({ collection: "bills", operation: "delete", recordId: "b2" }),
      mutation({ collection: "payments", operation: "delete", recordId: "p1" }),
      mutation({ collection: "payments", operation: "update", recordId: "p-missing" }),
      mutation({ collection: "unsupported", operation: "delete", recordId: "unknown" }),
      mutation({ collection: "expenses", operation: "create", recordId: "missing" }),
      mutation({ collection: "budgets", operation: "update", recordId: "unknown" }),
    ]);
    expect(result.expenses.find((item) => item.id === "e1")).toEqual(replacementExpense);
    expect(result.expenses.some((item) => item.id === "2")).toBe(false);
    expect(result.expenses.some((item) => item.id === "e-new")).toBe(true);
    expect(result.goals.find((item) => item.id === "1")).toEqual(updatedGoal);
    expect(result.goals.some((item) => item.id === "2")).toBe(false);
    expect(result.modules.bills).toContainEqual(addedBill);
    expect(result.modules.bills.some((item) => item.id === "b2")).toBe(false);
    expect(result.modules.payments).toEqual([]);
  });
});

describe("alerts and module payloads", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-01T10:00:00"));
  });

  it("builds offline, due bill, payment, budget, and current EMI alerts", () => {
    const modules = {
      ...initialModules,
      bills: [
        { id: "late", title: "Late", detail: "Past due", status: "Overdue" },
        ...Array.from({ length: 6 }, (_, index) => ({ id: `due-${index}`, title: `Due ${index}`, detail: "Today", status: "Due" })),
        { id: "paid", title: "Paid", detail: "Done", status: "Paid" },
      ],
      payments: [
        { id: "pending", title: "Pending", detail: "Today", status: "Pending" },
        { id: "due", title: "Due", detail: "Today", status: "Due" },
        { id: "paid", title: "Paid", detail: "Done", status: "Paid" },
      ],
      budgets: [
        { id: "risk", title: "Food", detail: "Monthly", amount: 1 },
        { id: "ok", title: "Transport", detail: "Monthly", amount: 100000 },
        { id: "no-amount", title: "Housing", detail: "Monthly" },
      ],
    } as typeof initialModules;
    const expenses: Expense[] = [
      { id: "cost", title: "Lunch", category: "Food", amount: 100000, date: "2026-11-01" },
      { id: "emi", title: "Phone EMI", category: "Phone", amount: 300, date: "2026-11-01", isEmi: true, months: 3 },
      { id: "emi2", title: "Default term", category: "Phone", amount: 100, date: "2026-11-01", isEmi: true },
      { id: "empty-emi", title: "No installments", category: "Phone", amount: 100, date: "2026-11-01", isEmi: true, months: 0 },
      ...Array.from({ length: 3 }, (_, index) => ({ id: `old-${index}`, title: "Past", category: "Phone", amount: 100, date: "2020-01-01", isEmi: true })),
    ];
    const alerts = buildAlerts(expenses, modules, true);
    expect(alerts.filter((alert) => alert.id.startsWith("bill-"))).toHaveLength(5);
    expect(alerts.some((alert) => alert.id === "bill-late" && alert.severity === "high")).toBe(true);
    expect(alerts.some((alert) => alert.id === "payment-pending")).toBe(true);
    expect(alerts.some((alert) => alert.id === "budget-risk")).toBe(true);
    expect(alerts.some((alert) => alert.id === "budget-ok")).toBe(false);
    expect(alerts.some((alert) => alert.id === "emi-emi")).toBe(true);
    expect(alerts.some((alert) => alert.id === "emi-emi2")).toBe(true);
    expect(alerts.some((alert) => alert.id === "emi-empty-emi")).toBe(false);
    expect(alerts.filter((alert) => alert.id.startsWith("emi-old-"))).toHaveLength(0);
    expect(alerts[0]).toMatchObject({ id: "offline", screen: "more" });
    expect(buildAlerts([], initialModules, false)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "bill-b1", severity: "medium" }),
    ]));
    jest.useRealTimers();
  });

  it("maps module resources and returns specialized and generic payloads", () => {
    const modules: ModuleKey[] = ["bills", "payments", "transfers", "income", "loans", "insurance", "budgets", "categories", "investments", "rewards", "netWorth", "subscriptions"];
    expect(modules.map(moduleResource)).toEqual([
      "bills", "payments", "transfers", "income", "loans", "insurance", "budget-rules",
      "categories", "investments", "reward-points", "net-worth-snapshots", undefined,
    ]);
    expect(modulePayload("categories", { title: "Food", detail: "Meals", amount: 10 })).toEqual({ title: "Food", description: "Meals" });
    expect(modulePayload("budgets", { title: "Food", amount: 100, enabled: false })).toMatchObject({
      type: "category", targetId: "Food", thresholdAmount: 100, period: "monthly", enabled: false,
    });
    expect(modulePayload("budgets", { title: "Food" })).toMatchObject({ thresholdAmount: 0, enabled: true });
    expect(modulePayload("income", { title: "Salary" })).toMatchObject({ source: "Salary", amount: 0 });
    expect(modulePayload("bills", { title: "Power", detail: "Monthly", amount: 20 })).toEqual({ title: "Power", note: "Monthly", amount: 20 });
    expect(modulePayload("payments", { title: "Card", status: "Paid" })).toMatchObject({ status: "Paid" });
    expect(modulePayload("reconciliation", { status: "Verified" })).toEqual({ reconciled: true });
    expect(moduleResource("reconciliation")).toBe("expenses");
    expect(createLocalId()).toMatch(/^local-\d+-[a-z0-9]+$/);
  });
});
