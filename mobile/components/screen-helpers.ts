import { Alert } from "react-native";
import type { ModuleKey, Screen } from "./types";

export function isModuleScreen(screen: Screen): screen is ModuleKey {
  return (
    screen !== "dashboard" &&
    screen !== "expenses" &&
    screen !== "accounts" &&
    screen !== "goals" &&
    screen !== "more" &&
    screen !== "secureVault" &&
    screen !== "personalRecords"
  );
}

export function promptText(title: string, message: string): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.prompt(title, message, (value) => resolve(value), "plain-text");
  });
}

export function moduleDescription(module: ModuleKey): string {
  const descriptions: Record<ModuleKey, string> = {
    bills: "Track due dates and recurring payments.",
    payments: "Record payments against your cards.",
    transfers: "Move money between your accounts.",
    income: "Keep salary and other inflows organized.",
    loans: "Track principal, interest, and repayments.",
    insurance: "Manage policies and premium payments.",
    budgets: "Set thresholds and get spending alerts.",
    categories: "Manage your spending categories.",
    investments: "Track holdings and current value.",
    rewards: "Monitor earned, redeemed, and expired points.",
    subscriptions: "Keep recurring services visible.",
    reconciliation: "Review and reconcile account activity.",
    calendar: "See bills, payments, and financial events.",
    visualize: "Understand trends and spending patterns.",
    import: "Bring records into Budget Tracker.",
    export: "Download your financial records.",
    household: "Manage shared household access.",
    netWorth: "Review snapshots of your financial position.",
    about: "Privacy, version, and app information.",
  };
  return descriptions[module];
}
