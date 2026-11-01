import { getEmiSchedule, forecastBudget } from "./calculations";
import { initialModules, moduleLabels, money } from "./components/constants";
import type { AccountOption, Expense, Goal, MobileAlert, ModuleItem, ModuleKey, RemoteRecord } from "./components/types";
import type { PendingMutation } from "./api";

function remoteString(item: RemoteRecord, key: string, fallback: string) {
  const value = item[key];
  return typeof value === "string" ? value : fallback;
}

function remoteNumber(item: RemoteRecord, key: string) {
  const value = item[key];
  return typeof value === "number" ? value : Number(value ?? 0);
}

export function buildAlerts(expenses: Expense[], modules: Record<ModuleKey, ModuleItem[]>, offline: boolean): MobileAlert[] {
  const alerts: MobileAlert[] = [];
  if (offline) alerts.push({ id: "offline", title: "Offline mode", detail: "Changes are saved locally and will sync when connected.", severity: "medium", screen: "more" });
  modules.bills.filter((item) => item.status === "Due" || item.status === "Overdue").slice(0, 5).forEach((item) => {
    alerts.push({ id: `bill-${item.id}`, title: `${item.title} is due`, detail: item.detail, severity: item.status === "Overdue" ? "high" : "medium", screen: "bills" });
  });
  modules.payments.filter((item) => item.status === "Pending" || item.status === "Due").slice(0, 5).forEach((item) => {
    alerts.push({ id: `payment-${item.id}`, title: `${item.title} payment pending`, detail: item.detail, severity: "high", screen: "payments" });
  });
  modules.budgets.filter((item) => typeof item.amount === "number").forEach((item) => {
    const forecast = forecastBudget({ title: item.title, budgetAmount: item.amount ?? 0, budgetMode: "monthly" }, expenses);
    if (forecast.willExceed) alerts.push({ id: `budget-${item.id}`, title: `${item.title} budget at risk`, detail: `Forecast ${money(forecast.projectedSpent)} against ${money(forecast.limit)}.`, severity: "high", screen: "budgets" });
  });
  expenses.filter((item) => item.isEmi).slice(0, 3).forEach((item) => {
    const schedule = getEmiSchedule(item.amount, 0, item.months ?? 12, item.date);
    const due = schedule.find((entry) => entry.status === "due");
    if (due) alerts.push({ id: `emi-${item.id}`, title: `${item.title} EMI is due`, detail: `Installment ${due.paymentNumber} · ${money(due.paymentAmount)}`, severity: "medium", screen: "expenses" });
  });
  return alerts;
}

export function hydrateModules(current: Record<ModuleKey, ModuleItem[]>, snapshot: Record<string, unknown>) {
  const next = { ...current };
  const mapping: Partial<Record<ModuleKey, string>> = {
    bills: "bills", payments: "payments", transfers: "transfers", income: "income",
    loans: "loans", insurance: "insurance", budgets: "budget-rules", categories: "categories",
    investments: "investments", rewards: "reward-points", netWorth: "net-worth-snapshots",
  };
  (Object.entries(mapping) as [ModuleKey, string][]).forEach(([module, resource]) => {
    const records = snapshot[resource];
    if (!Array.isArray(records)) return;
    next[module] = records.map((raw: unknown, index: number) => {
      const item = (raw && typeof raw === "object" ? raw : {}) as RemoteRecord;
      return {
        id: remoteString(item, "id", remoteString(item, "_id", `${module}-${index}`)),
        title: remoteString(item, "name", remoteString(item, "title", remoteString(item, "source", moduleLabels[module]))),
        detail: remoteString(item, "note", remoteString(item, "provider", "Synced from Budget Tracker")),
        amount: remoteNumber(item, "amount") || remoteNumber(item, "currentValue") || remoteNumber(item, "thresholdAmount"),
        status: remoteString(item, "status", item.enabled === false ? "Disabled" : "Active"),
        enabled: item.enabled !== false,
      };
    });
  });
  return next;
}

export function snapshotExpenses(snapshot: Record<string, unknown>): Expense[] {
  const records = Array.isArray(snapshot.expenses) ? snapshot.expenses : [];
  return records.map((raw: unknown) => {
    const item = (raw && typeof raw === "object" ? raw : {}) as RemoteRecord;
    return {
      id: remoteString(item, "id", remoteString(item, "_id", "")),
      title: remoteString(item, "details", "Expense"),
      category: remoteString(item, "categoryId", "Uncategorized"),
      amount: remoteNumber(item, "amount"),
      date: remoteString(item, "date", ""),
      isEmi: item.isEmi === true,
      months: typeof item.emiMonths === "number" ? item.emiMonths : undefined,
    };
  });
}

export function snapshotGoals(snapshot: Record<string, unknown>): Goal[] {
  const records = Array.isArray(snapshot["savings-goals"]) ? snapshot["savings-goals"] : [];
  return records.map((raw: unknown, index: number) => {
    const item = (raw && typeof raw === "object" ? raw : {}) as RemoteRecord;
    return {
      id: remoteString(item, "id", remoteString(item, "_id", "")),
      title: remoteString(item, "title", "Savings goal"),
      target: remoteNumber(item, "targetAmount"),
      saved: remoteNumber(item, "currentAmount"),
      color: ["#0f766e", "#2563eb", "#c27a2c"][index % 3],
    };
  });
}

export function snapshotAccounts(snapshot: Record<string, unknown>): AccountOption[] {
  const records = Array.isArray(snapshot.cards) ? snapshot.cards : [];
  return records.map((raw: unknown) => {
    const item = (raw && typeof raw === "object" ? raw : {}) as RemoteRecord;
    return {
      id: remoteString(item, "id", remoteString(item, "_id", "")),
      title: remoteString(item, "title", "Account"),
    };
  }).filter((account) => account.id);
}

export function applyPendingMutations(
  expenses: Expense[],
  goals: Goal[],
  modules: Record<ModuleKey, ModuleItem[]>,
  pending: PendingMutation[],
) {
  let nextExpenses = expenses;
  let nextGoals = goals;
  let nextModules = modules;
  for (const mutation of pending) {
    const id = mutation.recordId;
    if (mutation.collection === "expenses") {
      if (mutation.operation === "delete") nextExpenses = nextExpenses.filter((item) => item.id !== id);
      else if (mutation.optimisticRecord) {
        const record = mutation.optimisticRecord as Expense;
        nextExpenses = [...nextExpenses.filter((item) => item.id !== record.id), record];
      }
    } else if (mutation.collection === "goals") {
      if (mutation.operation === "delete") nextGoals = nextGoals.filter((item) => item.id !== id);
      else if (mutation.optimisticRecord) {
        const record = mutation.optimisticRecord as Goal;
        nextGoals = [...nextGoals.filter((item) => item.id !== record.id), record];
      }
    } else if (mutation.collection in nextModules) {
      const module = mutation.collection as ModuleKey;
      if (mutation.operation === "delete") {
        nextModules = { ...nextModules, [module]: nextModules[module].filter((item) => item.id !== id) };
      } else if (mutation.optimisticRecord) {
        const record = mutation.optimisticRecord as ModuleItem;
        nextModules = { ...nextModules, [module]: [...nextModules[module].filter((item) => item.id !== record.id), record] };
      }
    }
  }
  return { expenses: nextExpenses, goals: nextGoals, modules: nextModules };
}

export function createLocalId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function moduleResource(module: ModuleKey) {
  const mapping: Partial<Record<ModuleKey, string>> = {
    bills: "bills", payments: "payments", transfers: "transfers", income: "income",
    loans: "loans", insurance: "insurance", budgets: "budget-rules", categories: "categories",
    investments: "investments", rewards: "reward-points", netWorth: "net-worth-snapshots",
  };
  return mapping[module];
}

export function modulePayload(module: ModuleKey, item: Partial<ModuleItem>) {
  const common = { title: item.title, note: item.detail, amount: item.amount };
  if (module === "categories") return { title: item.title, description: item.detail };
  if (module === "budgets") return { type: "category", targetId: item.title, thresholdAmount: item.amount ?? 0, period: "monthly", enabled: item.enabled ?? true, createdAt: new Date().toISOString() };
  if (module === "income") return { source: item.title, amount: item.amount ?? 0, date: new Date().toISOString() };
  return common;
}

export { initialModules };
