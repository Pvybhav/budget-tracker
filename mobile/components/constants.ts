import type { Expense, Goal, ModuleItem, ModuleKey } from "./types";

export const initialExpenses: Expense[] = [
  { id: "1", title: "KFC", category: "Food & dining", amount: 680, date: "Today" },
  { id: "2", title: "Rent payment", category: "Housing", amount: 24000, date: "Yesterday" },
  { id: "3", title: "iPhone 15", category: "Electronics", amount: 5499, date: "12 Jun", isEmi: true, months: 12 },
  { id: "4", title: "Uber", category: "Transport", amount: 420, date: "11 Jun" },
  { id: "5", title: "Lulu supermarket", category: "Groceries", amount: 2350, date: "10 Jun" },
];

export const initialGoals: Goal[] = [
  { id: "1", title: "Emergency fund", target: 100000, saved: 64000, color: "#0f766e" },
  { id: "2", title: "New laptop", target: 85000, saved: 28000, color: "#2563eb" },
  { id: "3", title: "Holiday", target: 60000, saved: 19500, color: "#c27a2c" },
];

export const moduleLabels: Record<ModuleKey, string> = {
  bills: "Bills & subscriptions", payments: "Payments", transfers: "Account transfers", income: "Income",
  loans: "Loans", insurance: "Insurance", budgets: "Budget rules", categories: "Categories",
  investments: "Investments", rewards: "Rewards", subscriptions: "Subscriptions",
  reconciliation: "Reconciliation", calendar: "Financial calendar", visualize: "Reports & insights",
  import: "Import data", export: "Export data", household: "Household", netWorth: "Net-worth history", about: "About",
};

export const initialModules: Record<ModuleKey, ModuleItem[]> = {
  bills: [{ id: "b1", title: "Electricity", detail: "Due 18 Jun · recurring monthly", amount: 2480, status: "Due" }, { id: "b2", title: "Internet", detail: "Due 22 Jun · Airtel", amount: 999, status: "Paid" }],
  payments: [{ id: "p1", title: "SBI Cashback Card", detail: "Payment due 25 Jun", amount: 26480, status: "Pending" }],
  transfers: [{ id: "t1", title: "HDFC → Savings", detail: "12 Jun · Monthly transfer", amount: 15000, status: "Completed" }],
  income: [{ id: "i1", title: "Salary", detail: "HDFC Salary Account · 1 Jun", amount: 275000, status: "Received" }, { id: "i2", title: "Freelance project", detail: "5 Jun", amount: 18000, status: "Received" }],
  loans: [{ id: "l1", title: "Home renovation loan", detail: "HDFC · 10.5% · 24 months", amount: 18500, status: "Active" }],
  insurance: [{ id: "ins1", title: "Health insurance", detail: "Star Health · premium due Jul", amount: 4200, status: "Active" }],
  budgets: [{ id: "bu1", title: "Food & dining", detail: "Monthly threshold", amount: 18000, status: "Enabled", enabled: true }, { id: "bu2", title: "Transport", detail: "Monthly threshold", amount: 10000, status: "Enabled", enabled: true }],
  categories: [{ id: "c1", title: "Food & dining", detail: "12 transactions this month", status: "Active" }, { id: "c2", title: "Housing", detail: "2 transactions this month", status: "Active" }],
  investments: [{ id: "iv1", title: "Nifty 50 Index Fund", detail: "Groww · 42 units", amount: 128400, status: "+12.4%" }],
  rewards: [{ id: "r1", title: "SBI Cashback Card", detail: "Points earned this month", amount: 1840, status: "Earned" }],
  subscriptions: [{ id: "s1", title: "Netflix", detail: "Renews 20 Jun", amount: 649, status: "Active" }, { id: "s2", title: "Figma", detail: "Renews 28 Jun", amount: 1200, status: "Active" }],
  reconciliation: [{ id: "rc1", title: "June account review", detail: "HDFC Salary Account", status: "3 items to review" }],
  calendar: [{ id: "cal1", title: "18 Jun", detail: "Electricity bill due", amount: 2480, status: "Upcoming" }, { id: "cal2", title: "25 Jun", detail: "Credit card payment", amount: 26480, status: "Upcoming" }],
  visualize: [{ id: "v1", title: "Monthly spending", detail: "June 2025", amount: 35849, status: "Report" }],
  import: [{ id: "im1", title: "CSV import", detail: "Bring expenses from a spreadsheet", status: "Ready" }],
  export: [{ id: "ex1", title: "Export all data", detail: "CSV and JSON formats", status: "Available" }],
  household: [{ id: "h1", title: "Alex", detail: "Owner · alex@example.com", status: "Active" }],
  netWorth: [{ id: "nw1", title: "June 2025", detail: "Assets ₹512,000 · liabilities ₹73,480", amount: 438520, status: "Snapshot" }],
  about: [{ id: "a1", title: "Budget Tracker", detail: "Private personal finance workspace", status: "v1.0" }],
};

export const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;

export const categoryColors: Record<string, string> = {
  "Food & dining": "#f4b183",
  Housing: "#8bb8e8",
  Electronics: "#a99be8",
  Transport: "#78c7b5",
  Groceries: "#f39b9b",
};
