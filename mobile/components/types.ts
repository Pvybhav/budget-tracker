export type ModuleKey =
  | "bills" | "payments" | "transfers" | "income" | "loans" | "insurance"
  | "budgets" | "categories" | "investments" | "rewards" | "subscriptions"
  | "reconciliation" | "calendar" | "visualize" | "import" | "export"
  | "household" | "netWorth" | "about";
export type Screen = "dashboard" | "expenses" | "accounts" | "goals" | "more" | "secureVault" | "personalRecords" | ModuleKey;
export type Expense = { id: string; title: string; category: string; amount: number; date: string; cardId?: string; isEmi?: boolean; months?: number };
export type Goal = { id: string; title: string; target: number; saved: number; color: string };
export type AccountOption = { id: string; title: string };
export type ModuleItem = { id: string; title: string; detail: string; amount?: number; status?: string; enabled?: boolean };
export type RemoteRecord = Record<string, unknown>;
export type MobileAlert = { id: string; title: string; detail: string; severity: "high" | "medium" | "info"; screen: Screen };
