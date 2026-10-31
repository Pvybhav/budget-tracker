import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { updateBudgetTrackerWidget } from "./widget";
import { useShareIntent } from "expo-share-intent";
import * as Notifications from "expo-notifications";
import * as Calendar from "expo-calendar";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import * as Network from "expo-network";
import * as QuickActions from "expo-quick-actions";
import { CameraView } from "expo-camera";
import * as TextExtractor from "expo-text-extractor";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import * as XLSX from "xlsx";
import { AppState, Animated, Easing, Platform } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { acceptHouseholdInvite, ApiError, enqueueMutation, fetchHousehold, fetchMobileSnapshot, getCachedUser, getPendingMutations, getSession, getToken, inviteHouseholdMember, leaveHousehold, login, logout, removeHouseholdMember, signup, syncPendingMutations, type PendingMutation } from "./api";
import { calcMonthlyEmi, compareMonthlySpending, getEmiSchedule, getMonthlyExpenseAmount, forecastBudget } from "./calculations";
import { parseReceiptText, parseStatementText, parseVoiceExpense, type ImportedStatementRow } from "./parsing";

type ModuleKey =
  | "bills" | "payments" | "transfers" | "income" | "loans" | "insurance"
  | "budgets" | "categories" | "investments" | "rewards" | "subscriptions"
  | "reconciliation" | "calendar" | "visualize" | "import" | "export"
  | "household" | "netWorth" | "about";
type Screen = "dashboard" | "expenses" | "accounts" | "goals" | "more" | ModuleKey;
type Expense = { id: string; title: string; category: string; amount: number; date: string; cardId?: string; isEmi?: boolean; months?: number };
type Goal = { id: string; title: string; target: number; saved: number; color: string };
type AccountOption = { id: string; title: string };
type ModuleItem = { id: string; title: string; detail: string; amount?: number; status?: string; enabled?: boolean };
type RemoteRecord = Record<string, unknown>;
type MobileAlert = { id: string; title: string; detail: string; severity: "high" | "medium" | "info"; screen: Screen };
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true }),
});

const BACKGROUND_SYNC_TASK = "budget-tracker-background-sync";
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const session = await getSession();
    const result = await syncPendingMutations(session.user.username, () => undefined);
    if (result.error) throw result.error;
    const snapshot = await fetchMobileSnapshot();
    await AsyncStorage.setItem("budget-tracker-mobile-background-cache", JSON.stringify({
      username: session.user.username,
      snapshot,
      syncedAt: Date.now(),
    }));
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.warn("Background sync failed", error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

void Notifications.setNotificationCategoryAsync("budget-alert", [
  { identifier: "SNOOZE", buttonTitle: "Snooze 24h", options: { opensAppToForeground: false } },
  { identifier: "DISMISS", buttonTitle: "Dismiss", options: { isDestructive: true, opensAppToForeground: false } },
]).catch((error) => console.warn("Could not register notification actions", error));

const initialExpenses: Expense[] = [
  { id: "1", title: "KFC", category: "Food & dining", amount: 680, date: "Today" },
  { id: "2", title: "Rent payment", category: "Housing", amount: 24000, date: "Yesterday" },
  { id: "3", title: "iPhone 15", category: "Electronics", amount: 5499, date: "12 Jun", isEmi: true, months: 12 },
  { id: "4", title: "Uber", category: "Transport", amount: 420, date: "11 Jun" },
  { id: "5", title: "Lulu supermarket", category: "Groceries", amount: 2350, date: "10 Jun" },
];

const initialGoals: Goal[] = [
  { id: "1", title: "Emergency fund", target: 100000, saved: 64000, color: "#0f766e" },
  { id: "2", title: "New laptop", target: 85000, saved: 28000, color: "#2563eb" },
  { id: "3", title: "Holiday", target: 60000, saved: 19500, color: "#c27a2c" },
];

const moduleLabels: Record<ModuleKey, string> = {
  bills: "Bills & subscriptions", payments: "Payments", transfers: "Account transfers", income: "Income",
  loans: "Loans", insurance: "Insurance", budgets: "Budget rules", categories: "Categories",
  investments: "Investments", rewards: "Rewards", subscriptions: "Subscriptions",
  reconciliation: "Reconciliation", calendar: "Financial calendar", visualize: "Reports & insights",
  import: "Import data", export: "Export data", household: "Household", netWorth: "Net-worth history", about: "About",
};

const initialModules: Record<ModuleKey, ModuleItem[]> = {
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

const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;
const categoryColors: Record<string, string> = {
  "Food & dining": "#f4b183",
  Housing: "#8bb8e8",
  Electronics: "#a99be8",
  Transport: "#78c7b5",
  Groceries: "#f39b9b",
};

function remoteString(item: RemoteRecord, key: string, fallback: string) {
  const value = item[key];
  return typeof value === "string" ? value : fallback;
}

function remoteNumber(item: RemoteRecord, key: string) {
  const value = item[key];
  return typeof value === "number" ? value : Number(value ?? 0);
}

function buildAlerts(expenses: Expense[], modules: Record<ModuleKey, ModuleItem[]>, offline: boolean): MobileAlert[] {
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

function hydrateModules(current: Record<ModuleKey, ModuleItem[]>, snapshot: Record<string, unknown>) {
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

function snapshotExpenses(snapshot: Record<string, unknown>): Expense[] {
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

function snapshotGoals(snapshot: Record<string, unknown>): Goal[] {
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

function snapshotAccounts(snapshot: Record<string, unknown>): AccountOption[] {
  const records = Array.isArray(snapshot.cards) ? snapshot.cards : [];
  return records.map((raw: unknown) => {
    const item = (raw && typeof raw === "object" ? raw : {}) as RemoteRecord;
    return {
      id: remoteString(item, "id", remoteString(item, "_id", "")),
      title: remoteString(item, "title", "Account"),
    };
  }).filter((account) => account.id);
}

function applyPendingMutations(
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

function createLocalId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function moduleResource(module: ModuleKey) {
  const mapping: Partial<Record<ModuleKey, string>> = {
    bills: "bills", payments: "payments", transfers: "transfers", income: "income",
    loans: "loans", insurance: "insurance", budgets: "budget-rules", categories: "categories",
    investments: "investments", rewards: "reward-points", netWorth: "net-worth-snapshots",
  };
  return mapping[module];
}

function modulePayload(module: ModuleKey, item: Partial<ModuleItem>) {
  const common = { title: item.title, note: item.detail, amount: item.amount };
  if (module === "categories") return { title: item.title, description: item.detail };
  if (module === "budgets") return { type: "category", targetId: item.title, thresholdAmount: item.amount ?? 0, period: "monthly", enabled: item.enabled ?? true, createdAt: new Date().toISOString() };
  if (module === "income") return { source: item.title, amount: item.amount ?? 0, date: new Date().toISOString() };
  return common;
}

export default function App() {
  const [user, setUser] = useState<{ username: string; fullName: string; role: string } | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [hydratedUser, setHydratedUser] = useState<string | null>(null);
  const [initialSyncUser, setInitialSyncUser] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [expenses, setExpenses] = useState(initialExpenses);
  const [goals, setGoals] = useState(initialGoals);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [modules, setModules] = useState(initialModules);
  const [modal, setModal] = useState<"expense" | "goal" | "emi" | "data" | "voice" | "receipt" | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [networkOnline, setNetworkOnline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [retryableSyncError, setRetryableSyncError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [household, setHousehold] = useState<{ role: "owner" | "member" | "none"; members: { email: string; status: string }[] }>({ role: "none", members: [] });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notifiedAlertIds, setNotifiedAlertIds] = useState<string[]>([]);
  const [notificationStateLoaded, setNotificationStateLoaded] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [snoozedAlerts, setSnoozedAlerts] = useState<Record<string, number>>({});
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const [sharedReceiptUri, setSharedReceiptUri] = useState<string | null>(null);
  const [sharedImportText, setSharedImportText] = useState<string | null>(null);
  const { hasShareIntent, shareIntent, resetShareIntent, error: shareIntentError } = useShareIntent({ disabled: Platform.OS === "web" });
  const processedShareRef = useRef<string | null>(null);
  const syncInProgressRef = useRef(false);
  const alerts = useMemo(() => buildAlerts(expenses, modules, offline).filter((alert) => !dismissedAlerts.includes(alert.id) && (!snoozedAlerts[alert.id] || snoozedAlerts[alert.id] <= Date.now())), [expenses, modules, offline, dismissedAlerts, snoozedAlerts]);

  const refreshSnapshot = useCallback(async () => {
    const snapshot = await fetchMobileSnapshot();
    setExpenses(snapshotExpenses(snapshot));
    setGoals(snapshotGoals(snapshot));
    setAccounts(snapshotAccounts(snapshot));
    setModules((current) => hydrateModules(current, snapshot));
    try {
      const householdSnapshot = await fetchHousehold();
      setHousehold({ role: householdSnapshot.role, members: householdSnapshot.household?.members ?? [] });
    } catch (error) {
      console.warn("Could not refresh household data", error);
    }
  }, []);

  const syncData = useCallback(async () => {
    if (!user || hydratedUser !== user.username || !networkOnline || syncInProgressRef.current) return;
    syncInProgressRef.current = true;
    setSyncing(true);
    setSyncError(null);
    setRetryableSyncError(false);
    try {
      const result = await syncPendingMutations(user.username, (mutation, serverId) => {
        const localId = mutation.recordId;
        if (mutation.collection === "expenses") {
          setExpenses((current) => current.map((item) => item.id === localId ? { ...item, id: serverId } : item));
        } else if (mutation.collection === "goals") {
          setGoals((current) => current.map((item) => item.id === localId ? { ...item, id: serverId } : item));
        } else if (mutation.collection in initialModules) {
          const module = mutation.collection as ModuleKey;
          setModules((current) => ({
            ...current,
            [module]: current[module].map((item) => item.id === localId ? { ...item, id: serverId } : item),
          }));
        }
      });
      setPendingCount(result.remaining);
      if (result.error) throw result.error;
      await refreshSnapshot();
      setOffline(false);
    } catch (error) {
      console.warn("Could not sync mobile changes", error);
      setOffline(true);
      setSyncError(error instanceof Error ? error.message : "Could not sync saved changes.");
      setRetryableSyncError(!(error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429));
      try {
        setPendingCount((await getPendingMutations(user.username)).length);
      } catch (queueError) {
        console.warn("Could not read the offline changes queue", queueError);
      }
    } finally {
      syncInProgressRef.current = false;
      setSyncing(false);
      setInitialSyncUser(user.username);
    }
  }, [user, hydratedUser, networkOnline, refreshSnapshot]);

  useEffect(() => {
    let active = true;
    const updateNetworkState = (state: Network.NetworkState) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setNetworkOnline(online);
      if (!online) setOffline(true);
      else {
        setSyncError(null);
        setRetryableSyncError(false);
        void syncData();
      }
    };
    const subscription = Network.addNetworkStateListener(updateNetworkState);
    void Network.getNetworkStateAsync().then((state) => {
      if (active) updateNetworkState(state);
    }).catch((error) => {
      console.warn("Could not determine network status", error);
      if (active) setOffline(true);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [syncData]);

  useEffect(() => {
    if (user && hydratedUser === user.username && networkOnline) void syncData();
  }, [user, hydratedUser, networkOnline, syncData]);

  useEffect(() => {
    if (user && hydratedUser === user.username && !networkOnline) setInitialSyncUser(user.username);
  }, [user, hydratedUser, networkOnline]);

  useEffect(() => {
    if (!user || !networkOnline || pendingCount === 0 || !retryableSyncError) return;
    const interval = setInterval(() => void syncData(), 60_000);
    return () => clearInterval(interval);
  }, [user, networkOnline, pendingCount, retryableSyncError, syncData]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && networkOnline) void syncData();
    });
    return () => subscription.remove();
  }, [networkOnline, syncData]);

  useEffect(() => {
    if (!user) return;
    void Promise.all([
      AsyncStorage.getItem("budget-tracker-mobile-notifications"),
      AsyncStorage.getItem("budget-tracker-mobile-notified-alerts"),
      AsyncStorage.getItem("budget-tracker-mobile-snoozed-alerts"),
    ]).then(([notifications, notified, snoozed]) => {
      if (notifications !== null) setNotificationsEnabled(notifications === "true");
      if (notified) setNotifiedAlertIds(JSON.parse(notified) as string[]);
      if (snoozed) setSnoozedAlerts(JSON.parse(snoozed) as Record<string, number>);
      setNotificationStateLoaded(true);
    }).catch(() => setNotificationStateLoaded(true));
  }, [user]);

  useEffect(() => {
    if (!hasShareIntent) {
      processedShareRef.current = null;
      return;
    }
    if (!user) return;
    const shareKey = `${shareIntent.files?.[0]?.path ?? ""}|${shareIntent.text ?? ""}`;
    if (processedShareRef.current === shareKey) return;
    processedShareRef.current = shareKey;
    void (async () => {
      try {
        const file = shareIntent.files?.[0];
        if (file && file.mimeType.startsWith("image/")) {
          setSharedReceiptUri(file.path);
          setModal("receipt");
        } else if (file) {
          const text = await FileSystem.readAsStringAsync(file.path);
          setSharedImportText(text);
          setModal("data");
        } else if (shareIntent.text) {
          setSharedImportText(shareIntent.text);
          setModal("data");
        }
      } catch (error) {
        Alert.alert("Could not open shared content", error instanceof Error ? error.message : "Try importing the file from the app.");
      } finally {
        resetShareIntent();
      }
    })();
  }, [user, hasShareIntent, shareIntent.files, shareIntent.text, resetShareIntent]);

  useEffect(() => {
    if (shareIntentError) Alert.alert("Share import failed", shareIntentError);
  }, [shareIntentError]);

  useEffect(() => {
    if (!user) return;
    void AsyncStorage.getItem("budget-tracker-mobile-biometric").then((value) => {
      const enabled = value === "true";
      setBiometricEnabled(enabled);
      if (enabled) setLocked(true);
    }).catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void AsyncStorage.getItem("budget-tracker-mobile-dark-mode")
      .then((value) => setDarkMode(value === "true"))
      .catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, { minimumInterval: 30 }).catch((error) => {
      console.warn("Could not register background sync", error);
    });
    return () => {
      void BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK).catch((error) => {
        console.warn("Could not unregister background sync", error);
      });
    };
  }, [user]);

  useEffect(() => {
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const action = response.actionIdentifier;
      const alertId = String(response.notification.request.content.data?.alertId ?? "");
      if (!alertId) return;
      if (action === "SNOOZE") {
        const next = { [alertId]: Date.now() + 24 * 60 * 60 * 1000 };
        void AsyncStorage.mergeItem("budget-tracker-mobile-snoozed-alerts", JSON.stringify(next))
          .catch((error) => console.warn("Could not persist notification snooze", error));
        setSnoozedAlerts((current) => ({ ...current, ...next }));
      } else if (action === "DISMISS") {
        void AsyncStorage.getItem("budget-tracker-mobile-dismissed-alerts").then((value) => {
          const dismissed = value ? JSON.parse(value) as string[] : [];
          const next = Array.from(new Set([...dismissed, alertId]));
          setDismissedAlerts(next);
          return AsyncStorage.setItem("budget-tracker-mobile-dismissed-alerts", JSON.stringify(next));
        }).catch((error) => console.warn("Could not persist notification dismissal", error));
      } else {
        const target = response.notification.request.content.data?.screen;
        if (typeof target === "string" && target in moduleLabels) setScreen(target as Screen);
      }
    });
    const quickActionSubscription = QuickActions.addListener((action) => {
      if (action.id === "add-expense") setModal("expense");
      if (action.id === "scan-receipt") setModal("receipt");
      if (action.id === "view-alerts") setAlertsOpen(true);
    });
    return () => {
      notificationSubscription.remove();
      quickActionSubscription.remove();
    };
  }, []);

  useEffect(() => {
    void QuickActions.isSupported().then((supported) => {
      if (!supported) return;
      return QuickActions.setItems([
        { id: "add-expense", title: "Add expense", subtitle: "Log a purchase quickly", icon: "compose", params: { href: "budget-tracker://quick-action/add-expense" } },
        { id: "scan-receipt", title: "Scan receipt", subtitle: "Capture and read a receipt", icon: "capturePhoto", params: { href: "budget-tracker://quick-action/scan-receipt" } },
        { id: "view-alerts", title: "View alerts", subtitle: "Check bills and budget risks", icon: "alarm", params: { href: "budget-tracker://quick-action/view-alerts" } },
      ]);
    }).catch((error) => console.warn("Could not configure app quick actions", error));
  }, []);

  useEffect(() => {
    if (!user || !QuickActions.initial) return;
    const initialAction = QuickActions.initial;
    if (initialAction.id === "add-expense") setModal("expense");
    if (initialAction.id === "scan-receipt") setModal("receipt");
    if (initialAction.id === "view-alerts") setAlertsOpen(true);
  }, [user]);

  const toggleDarkMode = (enabled: boolean) => {
    setDarkMode(enabled);
    void AsyncStorage.setItem("budget-tracker-mobile-dark-mode", String(enabled));
  };

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" && biometricEnabled) setLocked(true);
    });
    return () => subscription.remove();
  }, [biometricEnabled]);

  useEffect(() => {
    if (!user || !notificationsEnabled || !notificationStateLoaded) return;
    void (async () => {
      const permissions = await Notifications.getPermissionsAsync();
      if (!("granted" in permissions && permissions.granted === true)) {
        const requested = await Notifications.requestPermissionsAsync();
        if (!("granted" in requested && requested.granted === true)) return;
      }
      const newAlerts = alerts.filter((alert) => !notifiedAlertIds.includes(alert.id)).slice(0, 10);
      if (!newAlerts.length) return;
      for (const alert of newAlerts) {
        await Notifications.scheduleNotificationAsync({
          content: { title: alert.title, body: alert.detail, categoryIdentifier: "budget-alert", data: { screen: alert.screen, alertId: alert.id } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1 },
        });
      }
      const nextNotified = [...notifiedAlertIds, ...newAlerts.map((alert) => alert.id)].slice(-100);
      setNotifiedAlertIds(nextNotified);
      await AsyncStorage.setItem("budget-tracker-mobile-notified-alerts", JSON.stringify(nextNotified));
    })().catch((error) => console.warn("Could not schedule financial notifications", error));
  }, [alerts, notificationsEnabled, user, notifiedAlertIds, notificationStateLoaded]);

  useEffect(() => {
    if (!user) {
      updateBudgetTrackerWidget({ balance: "Sign in", spent: "—", alertCount: 0 });
      return;
    }
    updateBudgetTrackerWidget({
      balance: money(184250),
      spent: money(expenses.reduce((sum, expense) => sum + expense.amount, 0)),
      alertCount: alerts.length,
    });
  }, [user, expenses, alerts.length]);

  const toggleNotifications = (value: boolean) => {
    setNotificationsEnabled(value);
    void AsyncStorage.setItem("budget-tracker-mobile-notifications", String(value));
    if (!value) void Notifications.cancelAllScheduledNotificationsAsync();
  };

  const snoozeAlert = (id: string) => {
    const next = { ...snoozedAlerts, [id]: Date.now() + 24 * 60 * 60 * 1000 };
    setSnoozedAlerts(next);
    void AsyncStorage.setItem("budget-tracker-mobile-snoozed-alerts", JSON.stringify(next));
  };

  const unlock = async () => {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock Budget Tracker" });
    if (result.success) setLocked(false);
  };

  const toggleBiometric = async (value: boolean) => {
    if (value) {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!compatible || !enrolled) {
        Alert.alert("Biometrics unavailable", "Set up Face ID, Touch ID, or device biometrics first.");
        return;
      }
    }
    setBiometricEnabled(value);
    void AsyncStorage.setItem("budget-tracker-mobile-biometric", String(value));
    if (!value) setLocked(false);
  };

  useEffect(() => {
    void (async () => {
      try {
        if (await getToken()) {
          const networkState = await Network.getNetworkStateAsync().catch(() => null);
          if (networkState?.isConnected === false || networkState?.isInternetReachable === false) {
            const cachedUser = await getCachedUser();
            if (cachedUser) {
              setUser(cachedUser);
              setOffline(true);
            }
            return;
          }
          try {
            setUser((await getSession()).user);
          } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
              await logout();
            } else {
              const cachedUser = await getCachedUser();
              if (cachedUser) {
                setUser(cachedUser);
                setOffline(true);
              } else {
                console.warn("Could not restore the mobile session", error);
              }
            }
          }
        }
      } catch (error) {
        console.warn("Could not read the saved mobile session", error);
        setOffline(true);
      } finally {
        setIsBooting(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user) {
      setHydratedUser(null);
      return;
    }
    let cancelled = false;
    setHydratedUser(null);
    void Promise.all([
      AsyncStorage.getItem("budget-tracker-mobile-cache"),
      AsyncStorage.getItem("budget-tracker-mobile-background-cache"),
      getPendingMutations(user.username),
    ]).then(([cacheValue, backgroundValue, pending]) => {
      let cachedAt = 0;
      let localExpenses = initialExpenses;
      let localGoals = initialGoals;
      let localAccounts: AccountOption[] = [];
      let localModules = initialModules;
      if (cacheValue) {
        try {
          const cached = JSON.parse(cacheValue) as {
            username?: string;
            updatedAt?: number;
            expenses?: Expense[];
            goals?: Goal[];
            accounts?: AccountOption[];
            modules?: Record<ModuleKey, ModuleItem[]>;
          };
          if (cached.username === user.username) {
            cachedAt = typeof cached.updatedAt === "number" ? cached.updatedAt : 0;
            if (Array.isArray(cached.expenses)) localExpenses = cached.expenses;
            if (Array.isArray(cached.goals)) localGoals = cached.goals;
            if (Array.isArray(cached.accounts)) localAccounts = cached.accounts;
            if (cached.modules) localModules = cached.modules;
          }
        } catch (error) {
          console.warn("Could not read the mobile cache", error);
          setOffline(true);
        }
      }
      if (backgroundValue) {
        try {
          const cached = JSON.parse(backgroundValue) as {
            username?: string;
            syncedAt?: number;
            snapshot?: Record<string, unknown>;
          };
          if (cached.username === user.username && cached.snapshot && typeof cached.snapshot === "object" && (cached.syncedAt ?? 0) > cachedAt) {
            localExpenses = snapshotExpenses(cached.snapshot);
            localGoals = snapshotGoals(cached.snapshot);
            localAccounts = snapshotAccounts(cached.snapshot);
            localModules = hydrateModules(localModules, cached.snapshot);
          }
        } catch (error) {
          console.warn("Could not read the background sync cache", error);
          setOffline(true);
        }
      }
      const hydrated = applyPendingMutations(localExpenses, localGoals, localModules, pending);
      setExpenses(hydrated.expenses);
      setGoals(hydrated.goals);
      setAccounts(localAccounts);
      setModules(hydrated.modules);
      setPendingCount(pending.length);
      if (pending.length) setOffline(true);
    }).catch((error) => {
      console.warn("Could not load the mobile cache", error);
      setOffline(true);
      setSyncError(error instanceof Error ? error.message : "Could not load saved offline changes.");
    }).finally(() => {
      if (!cancelled) setHydratedUser(user.username);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || hydratedUser !== user.username) return;
    void AsyncStorage.setItem("budget-tracker-mobile-cache", JSON.stringify({
      username: user.username,
      updatedAt: Date.now(),
      expenses,
      goals,
      accounts,
      modules,
    })).catch((error) => console.warn("Could not save the mobile cache", error));
  }, [expenses, goals, accounts, modules, user, hydratedUser]);

  useEffect(() => {
    if (!user) return;
    void AsyncStorage.getItem("budget-tracker-mobile-dismissed-alerts").then((value) => {
      if (value) setDismissedAlerts(JSON.parse(value) as string[]);
    }).catch(() => undefined);
  }, [user]);

  const dismissAlert = (id: string) => {
    const next = [...dismissedAlerts, id];
    setDismissedAlerts(next);
    void AsyncStorage.setItem("budget-tracker-mobile-dismissed-alerts", JSON.stringify(next));
  };

  const refreshFromServer = async () => {
    setRefreshing(true);
    try {
      await syncData();
    } finally {
      setRefreshing(false);
    }
  };

  if (isBooting) return <SafeAreaView style={styles.safeArea}><SkeletonScreen variant="boot" darkMode={darkMode} /></SafeAreaView>;
  if (!user) return <AuthScreen onAuthenticated={setUser} />;
  if (locked) return <SafeAreaView style={styles.safeArea}><View style={styles.lockScreen}><Text style={styles.lockIcon}>◉</Text><Text style={styles.loadingTitle}>Budget Tracker is locked</Text><Text style={styles.muted}>Use your device biometrics to continue.</Text><Pressable style={styles.primaryButton} onPress={() => void unlock()}><Text style={styles.primaryButtonText}>Unlock securely</Text></Pressable></View></SafeAreaView>;
  if (hydratedUser !== user.username || initialSyncUser !== user.username) return <SafeAreaView style={[styles.safeArea, darkMode && styles.darkSafeArea]}><SkeletonScreen variant={screen} darkMode={darkMode} /></SafeAreaView>;

  const queueMutation = async (mutation: Omit<PendingMutation, "username" | "createdAt">) => {
    const pending = await enqueueMutation({ ...mutation, username: user.username, createdAt: Date.now() });
    setPendingCount(pending.length);
    return pending.length;
  };

  const addExpense = async (expense: Expense) => {
    const cardId = expense.cardId ?? accounts[0]?.id;
    if (!cardId) {
      Alert.alert("Account required", "Sync an account from the web app before saving an expense.");
      return;
    }
    const localExpense = { ...expense, id: createLocalId() };
    const categoryId = modules.categories.find((item) => item.title === expense.category)?.id;
    const payload = {
      details: expense.title,
      amount: expense.amount,
      date: new Date().toISOString(),
      cardId,
      ...(categoryId && /^[a-f\d]{24}$/i.test(categoryId) ? { categoryId } : {}),
      isEmi: expense.isEmi ?? false,
      emiMonths: expense.months,
      currency: "INR",
    };
    try {
      await queueMutation({
        id: createLocalId(),
        resource: "expenses",
        operation: "create",
        recordId: localExpense.id,
        payload,
        collection: "expenses",
        optimisticRecord: localExpense,
      });
      setExpenses((current) => [localExpense, ...current]);
      if (!networkOnline) setOffline(true);
      else void syncData();
      setModal(null);
    } catch (error) {
      Alert.alert("Expense not saved", error instanceof Error ? error.message : "Could not save this expense on the device.");
    }
  };

  const addGoal = async (goal: Goal) => {
    const localGoal = { ...goal, id: createLocalId() };
    const now = new Date().toISOString();
    try {
      await queueMutation({
        id: createLocalId(),
        resource: "savings-goals",
        operation: "create",
        recordId: localGoal.id,
        payload: {
        title: goal.title,
        targetAmount: goal.target,
        currentAmount: goal.saved,
        targetDate: now,
        createdAt: now,
        currency: "INR",
        },
        collection: "goals",
        optimisticRecord: localGoal,
      });
      setGoals((current) => [...current, localGoal]);
      if (!networkOnline) setOffline(true);
      else void syncData();
      setModal(null);
    } catch (error) {
      Alert.alert("Goal not saved", error instanceof Error ? error.message : "Could not save this goal on the device.");
    }
  };

  const addModuleItem = async (module: ModuleKey, item: ModuleItem) => {
    const resource = moduleResource(module);
    const localItem = { ...item, id: createLocalId() };
    if (!resource) {
      setModules((current) => ({ ...current, [module]: [...current[module], localItem] }));
      return;
    }
    try {
      await queueMutation({
        id: createLocalId(),
        resource,
        operation: "create",
        recordId: localItem.id,
        payload: modulePayload(module, item),
        collection: module,
        optimisticRecord: localItem,
      });
      setModules((current) => ({ ...current, [module]: [...current[module], localItem] }));
      if (!networkOnline) setOffline(true);
      else void syncData();
    } catch (error) {
      Alert.alert("Record not saved", error instanceof Error ? error.message : "Could not save this record on the device.");
    }
  };

  const updateModuleItem = async (module: ModuleKey, id: string, patch: Partial<ModuleItem>) => {
    const currentItem = modules[module].find((item) => item.id === id);
    if (!currentItem) return;
    const updatedItem = { ...currentItem, ...patch };
    const resource = moduleResource(module);
    if (!resource || initialModules[module].some((item) => item.id === id)) {
      setModules((current) => ({ ...current, [module]: current[module].map((item) => item.id === id ? updatedItem : item) }));
      return;
    }
    try {
      await queueMutation({
        id: createLocalId(),
        resource,
        operation: "update",
        recordId: id,
        payload: modulePayload(module, updatedItem),
        collection: module,
        optimisticRecord: updatedItem,
      });
      setModules((current) => ({ ...current, [module]: current[module].map((item) => item.id === id ? updatedItem : item) }));
      if (!networkOnline) setOffline(true);
      else void syncData();
    } catch (error) {
      Alert.alert("Record update not saved", error instanceof Error ? error.message : "Could not save the update on this device.");
    }
  };

  const deleteModuleItem = async (module: ModuleKey, id: string) => {
    const resource = moduleResource(module);
    if (!resource || initialModules[module].some((item) => item.id === id)) {
      setModules((current) => ({ ...current, [module]: current[module].filter((item) => item.id !== id) }));
      return;
    }
    try {
      await queueMutation({
        id: createLocalId(),
        resource,
        operation: "delete",
        recordId: id,
        collection: module,
      });
      setModules((current) => ({ ...current, [module]: current[module].filter((item) => item.id !== id) }));
      if (!networkOnline) setOffline(true);
      else void syncData();
    } catch (error) {
      Alert.alert("Record deletion not saved", error instanceof Error ? error.message : "Could not save the deletion on this device.");
    }
  };

  const selectExpense = (expense: Expense) => {
    if (expense.isEmi) {
      setSelectedExpense(expense);
      setModal("emi");
    }
  };

  const exportData = JSON.stringify({ expenses, goals, modules }, null, 2);
  const importData = async (value: string) => {
    try {
      if (value.trimStart().startsWith("{")) {
        const parsed = JSON.parse(value) as { expenses?: Expense[]; goals?: Goal[]; modules?: Record<ModuleKey, ModuleItem[]> };
        if (Array.isArray(parsed.expenses)) setExpenses(parsed.expenses);
        if (Array.isArray(parsed.goals)) setGoals(parsed.goals);
        if (parsed.modules && typeof parsed.modules === "object") setModules(parsed.modules);
      } else {
        const rows = parseStatementText(value);
        const existing = new Set(expenses.map((expense) => `${expense.date.slice(0, 10)}|${expense.amount}|${expense.title.toLowerCase()}`));
        const importedExpenses: Expense[] = [];
        const importedIncome: ModuleItem[] = [];
        let failedRows = 0;
        for (const row of rows) {
          const key = `${row.date}|${row.amount}|${row.details.toLowerCase()}`;
          if (existing.has(key)) continue;
          existing.add(key);
          try {
            if (row.kind === "income") {
              const localIncome = {
                id: createLocalId(),
                title: row.details,
                detail: `${row.date} · Imported statement`,
                amount: row.amount,
                status: "Imported",
              };
              await queueMutation({
                id: createLocalId(),
                resource: "income",
                operation: "create",
                recordId: localIncome.id,
                payload: { source: row.details, amount: row.amount, date: `${row.date}T12:00:00`, currency: "INR" },
                collection: "income",
                optimisticRecord: localIncome,
              });
              importedIncome.push(localIncome);
            } else {
              if (!accounts[0]?.id) throw new Error("Sync an account before importing expenses.");
              const expense: Expense = { id: createLocalId(), title: row.details, category: "Imported", amount: row.amount, date: `${row.date}T12:00:00` };
              await queueMutation({
                id: createLocalId(),
                resource: "expenses",
                operation: "create",
                recordId: expense.id,
                payload: { details: row.details, amount: row.amount, date: `${row.date}T12:00:00`, cardId: accounts[0].id, currency: "INR", reconciled: false },
                collection: "expenses",
                optimisticRecord: expense,
              });
              importedExpenses.push(expense);
            }
          } catch {
            failedRows += 1;
          }
        }
        if (importedExpenses.length) setExpenses((current) => [...importedExpenses, ...current]);
        if (importedIncome.length) setModules((current) => ({ ...current, income: [...current.income, ...importedIncome] }));
        if (networkOnline && failedRows === 0) void syncData();
        Alert.alert("Import complete", `${rows.length - failedRows} transactions saved${pendingCount + importedExpenses.length + importedIncome.length > 0 ? " and queued to sync" : ""}${failedRows ? `; ${failedRows} could not be saved` : ""}. Duplicate transactions were skipped.`);
      }
      setModal(null);
    } catch {
      Alert.alert("Import failed", "Paste a valid Budget Tracker JSON export.");
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, darkMode && styles.darkSafeArea]}>
      <StatusBar style={darkMode ? "light" : "dark"} />
      <View style={[styles.app, darkMode && styles.darkApp]}>
        {(offline || pendingCount > 0 || syncing) && <Pressable style={styles.offlineBanner} onPress={() => void syncData()} disabled={!networkOnline || syncing}><Text style={styles.offlineText}>{syncError ? `Sync issue: ${syncError}` : syncing ? "Syncing saved changes…" : pendingCount ? `${pendingCount} saved change${pendingCount === 1 ? "" : "s"} waiting to sync` : "Offline mode · changes stay on this device until connection returns"}</Text>{networkOnline && pendingCount > 0 && !syncing && <Text style={styles.offlineAction}>Tap to sync now</Text>}</Pressable>}
        <TopBar screen={screen} onSettings={() => setScreen("more")} onAlerts={() => setAlertsOpen(true)} alertCount={alerts.length} darkMode={darkMode} user={user} />
        <AnimatedScreen screen={screen}>
          {screen === "dashboard" && <Dashboard darkMode={darkMode} expenses={expenses} goals={goals} onRefresh={refreshFromServer} refreshing={refreshing} onAddExpense={() => setModal("expense")} onVoiceExpense={() => setModal("voice")} onReceipt={() => setModal("receipt")} onOpenExpenses={() => setScreen("expenses")} onOpenGoals={() => setScreen("goals")} onNavigate={setScreen} />}
          {screen === "expenses" && <Expenses darkMode={darkMode} expenses={expenses} onRefresh={refreshFromServer} refreshing={refreshing} onAdd={() => setModal("expense")} onVoice={() => setModal("voice")} onReceipt={() => setModal("receipt")} onSelect={selectExpense} />}
          {screen === "accounts" && <Accounts darkMode={darkMode} />}
          {screen === "goals" && <Goals darkMode={darkMode} goals={goals} onAdd={() => setModal("goal")} />}
          {screen === "more" && <More darkMode={darkMode} setDarkMode={toggleDarkMode} notificationsEnabled={notificationsEnabled} setNotificationsEnabled={toggleNotifications} biometricEnabled={biometricEnabled} setBiometricEnabled={toggleBiometric} onNavigate={setScreen} onLogout={() => { void logout().then(() => setUser(null)); }} onSync={() => void syncData()} syncing={syncing} />}
          {isModuleScreen(screen) && <ModuleScreen darkMode={darkMode} module={screen} items={modules[screen]} household={household} onHouseholdChange={setHousehold} onRefresh={refreshFromServer} refreshing={refreshing} onExport={() => setModal("data")} onImport={() => setModal("data")} onAdd={(item) => void addModuleItem(screen, item)} onUpdate={(id, patch) => void updateModuleItem(screen, id, patch)} onDelete={(id) => void deleteModuleItem(screen, id)} />}
        </AnimatedScreen>
        <BottomNav screen={screen} setScreen={setScreen} />
      </View>
      <Modal visible={modal === "expense"} animationType="slide" transparent onRequestClose={() => setModal(null)}>
        <ExpenseForm accounts={accounts} onClose={() => setModal(null)} onSave={addExpense} />
      </Modal>
      <Modal visible={modal === "voice"} animationType="slide" transparent onRequestClose={() => setModal(null)}>
        <VoiceExpenseForm onClose={() => setModal(null)} onSave={addExpense} />
      </Modal>
      <Modal visible={modal === "receipt"} animationType="slide" transparent onRequestClose={() => setModal(null)}>
        {modal === "receipt" && <ReceiptScanner initialImageUri={sharedReceiptUri} onClose={() => { setSharedReceiptUri(null); setModal(null); }} onSave={(expense) => { setSharedReceiptUri(null); void addExpense(expense); }} />}
      </Modal>
      <Modal visible={modal === "goal"} animationType="slide" transparent onRequestClose={() => setModal(null)}>
        <GoalForm onClose={() => setModal(null)} onSave={addGoal} />
      </Modal>
      <Modal visible={modal === "emi"} animationType="slide" transparent onRequestClose={() => setModal(null)}>
        {selectedExpense && <EmiSchedule expense={selectedExpense} onClose={() => setModal(null)} />}
      </Modal>
      <Modal visible={modal === "data"} animationType="slide" transparent onRequestClose={() => setModal(null)}>
        {modal === "data" && <DataTransferForm exportData={exportData} initialText={sharedImportText} onImport={(value) => { setSharedImportText(null); void importData(value); }} onClose={() => { setSharedImportText(null); setModal(null); }} />}
      </Modal>
      <Modal visible={alertsOpen} animationType="slide" transparent onRequestClose={() => setAlertsOpen(false)}>
        <AlertCenter alerts={alerts} onDismiss={dismissAlert} onSnooze={snoozeAlert} onNavigate={(target) => { setAlertsOpen(false); setScreen(target); }} onClose={() => setAlertsOpen(false)} />
      </Modal>
    </SafeAreaView>
  );
}

function TopBar({ screen, onSettings, onAlerts, alertCount, darkMode, user }: { screen: Screen; onSettings: () => void; onAlerts: () => void; alertCount: number; darkMode: boolean; user: { fullName: string } }) {
  const titles: Record<Screen, string> = { dashboard: "Good morning, Alex", expenses: "Expenses", accounts: "Accounts & cards", goals: "Savings goals", more: "More", ...moduleLabels };
  return <View style={styles.topBar}><View><Text style={styles.overline}>BUDGET TRACKER</Text><Text style={[styles.topTitle, darkMode && styles.darkText]}>{screen === "dashboard" ? `Good morning, ${user.fullName}` : titles[screen]}</Text></View><View style={styles.topActions}><Pressable onPress={onAlerts} style={[styles.bellButton, darkMode && styles.darkControl]}><Text style={[styles.bellText, darkMode && styles.darkText]}>♢</Text>{alertCount > 0 && <View style={styles.alertBadge}><Text style={styles.alertBadgeText}>{alertCount > 9 ? "9+" : alertCount}</Text></View>}</Pressable><Pressable onPress={onSettings} style={styles.avatar}><Text style={styles.avatarText}>{darkMode ? "☼" : user.fullName.slice(0, 1).toUpperCase()}</Text></Pressable></View></View>;
}

function AnimatedScreen({ screen, children }: { screen: Screen; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    opacity.setValue(0);
    translateX.setValue(18);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, damping: 18, stiffness: 180, mass: 0.7, useNativeDriver: true }),
    ]).start();
  }, [screen, opacity, translateX]);
  return <Animated.View style={[styles.body, { opacity, transform: [{ translateX }] }]}>{children}</Animated.View>;
}

function SkeletonBlock({
  pulse,
  darkMode,
  width,
  height,
  radius = 10,
  style,
}: {
  pulse: Animated.Value;
  darkMode: boolean;
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: object;
}) {
  return <Animated.View style={[styles.skeletonBlock, darkMode && styles.darkSkeletonBlock, { width, height, borderRadius: radius, opacity: pulse }, style]} />;
}

function SkeletonScreen({ variant, darkMode }: { variant: Screen | "boot"; darkMode: boolean }) {
  const pulse = useRef(new Animated.Value(0.42)).current;
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.9, duration: 750, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.42, duration: 750, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const block = (width: number | `${number}%`, height: number, radius = 10, style?: object) => (
    <SkeletonBlock key={`${width}-${height}-${radius}-${String(style)}`} pulse={pulse} darkMode={darkMode} width={width} height={height} radius={radius} style={style} />
  );
  const row = (index: number) => (
    <View key={index} style={styles.skeletonRow}>
      {block(42, 42, 14)}
      <View style={styles.skeletonRowCopy}>{block("58%", 13)}{block("38%", 10)}</View>
      <View style={styles.skeletonRowAmount}>{block(54, 13)}{block(34, 9)}</View>
    </View>
  );

  return (
    <View accessibilityLabel="Loading content" accessibilityRole="progressbar" style={[styles.skeletonPage, darkMode && styles.darkScroll]}>
      {variant === "boot" ? (
        <View style={styles.skeletonBoot}>
          {block(62, 62, 22)}
          {block(210, 22, 8)}
          {block(164, 13, 6)}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {variant === "dashboard" ? (
            <>
              <View style={styles.skeletonHeader}>{block(132, 17)}{block(72, 30, 12)}</View>
              <View style={styles.skeletonHero}>
                {block(104, 10, 5)}{block(148, 29, 8)}{block(116, 10, 5)}
                <View style={styles.skeletonHeroCircle}>{block(38, 38, 19)}</View>
              </View>
              <View style={styles.skeletonStats}>{[1, 2, 3].map((item) => <View key={item} style={[styles.skeletonStat, darkMode && styles.darkSkeletonSurface]}>{block("55%", 10)}{block("74%", 17)}</View>)}</View>
              {block(150, 16, 6)}
              <View style={[styles.skeletonCard, darkMode && styles.darkSkeletonSurface]}>{block("100%", 112, 14)}{block("74%", 12)}{block("42%", 10)}</View>
              {block(112, 16, 6)}
              <View style={[styles.skeletonCard, darkMode && styles.darkSkeletonSurface]}>{[1, 2, 3].map(row)}</View>
            </>
          ) : variant === "expenses" ? (
            <>
              <View style={styles.skeletonHeader}>{block(158, 22)}{block(88, 34, 12)}</View>
              <View style={[styles.skeletonCard, darkMode && styles.darkSkeletonSurface]}>{block("42%", 10)}{block("68%", 22)}{block("100%", 14, 8)}</View>
              <View style={styles.skeletonChips}>{[72, 82, 88, 76].map((width) => block(width, 31, 16))}</View>
              <View style={[styles.skeletonCard, darkMode && styles.darkSkeletonSurface]}>{[1, 2, 3, 4, 5].map(row)}</View>
            </>
          ) : variant === "goals" ? (
            <>
              <View style={styles.skeletonHeader}>{block(142, 22)}{block(42, 42, 14)}</View>
              <View style={[styles.skeletonCard, darkMode && styles.darkSkeletonSurface]}>{block(88, 10)}{block("52%", 24)}{block("100%", 11)}</View>
              {[1, 2, 3].map((item) => <View key={item} style={[styles.skeletonCard, darkMode && styles.darkSkeletonSurface]}>{block("68%", 16)}{block("88%", 11)}{block("100%", 8, 6)}</View>)}
            </>
          ) : (
            <>
              <View style={styles.skeletonHeader}>{block("56%", 22)}{block(42, 42, 14)}</View>
              <View style={[styles.skeletonCard, darkMode && styles.darkSkeletonSurface]}>{block("36%", 10)}{block(92, 24)}{block("64%", 10)}</View>
              <View style={[styles.skeletonCard, darkMode && styles.darkSkeletonSurface]}>{[1, 2, 3, 4, 5].map(row)}</View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function AlertCenter({ alerts, onDismiss, onSnooze, onNavigate, onClose }: { alerts: MobileAlert[]; onDismiss: (id: string) => void; onSnooze: (id: string) => void; onNavigate: (screen: Screen) => void; onClose: () => void }) {
  return <View style={styles.modalBackdrop}><View style={styles.alertSheet}><View style={styles.formHeader}><View><Text style={styles.formTitle}>Alerts</Text><Text style={styles.muted}>{alerts.length ? "Action needed in your finances" : "You're all caught up"}</Text></View><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>{alerts.length ? <ScrollView>{alerts.map((alert) => <View key={alert.id} style={styles.alertRow}><View style={[styles.alertDot, alert.severity === "high" ? styles.alertHigh : alert.severity === "medium" ? styles.alertMedium : styles.alertInfo]} /><Pressable style={styles.alertCopy} onPress={() => { void Haptics.selectionAsync(); onNavigate(alert.screen); }}><Text style={styles.alertTitle}>{alert.title}</Text><Text style={styles.muted}>{alert.detail}</Text></Pressable><Pressable onPress={() => { void Haptics.selectionAsync(); onSnooze(alert.id); }}><Text style={styles.snoozeText}>Later</Text></Pressable><Pressable onPress={() => { void Haptics.selectionAsync(); onDismiss(alert.id); }}><Text style={styles.dismissText}>Dismiss</Text></Pressable></View>)}</ScrollView> : <View style={styles.emptyAlert}><Text style={styles.emptyAlertIcon}>✓</Text><Text style={styles.sectionTitle}>No new alerts</Text><Text style={styles.muted}>We'll surface upcoming bills, budget risks, and payment reminders here.</Text></View>}</View></View>;
}

function isModuleScreen(screen: Screen): screen is ModuleKey {
  return screen !== "dashboard" && screen !== "expenses" && screen !== "accounts" && screen !== "goals" && screen !== "more";
}

function Dashboard({ darkMode, expenses, goals, onRefresh, refreshing, onAddExpense, onVoiceExpense, onReceipt, onOpenExpenses, onOpenGoals, onNavigate }: { darkMode: boolean; expenses: Expense[]; goals: Goal[]; onRefresh: () => Promise<void>; refreshing: boolean; onAddExpense: () => void; onVoiceExpense: () => void; onReceipt: () => void; onOpenExpenses: () => void; onOpenGoals: () => void; onNavigate: (screen: Screen) => void }) {
  const spent = expenses.reduce((sum, expense) => sum + getMonthlyExpenseAmount({ amount: expense.amount, date: expense.date, isEmi: expense.isEmi, emiMonths: expense.months }, new Date()), 0);
  const monthlyComparison = compareMonthlySpending(expenses);
  return <ScrollView contentContainerStyle={[styles.scroll, darkMode && styles.darkScroll]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} colors={["#0f766e"]} />}>
    <View style={styles.monthRow}><View><Text style={[styles.monthLabel, darkMode && styles.darkText]}>June 2025</Text><Text style={styles.muted}>Monthly overview</Text></View><Pressable style={[styles.monthButton, darkMode && styles.darkControl]}><Text style={[styles.monthButtonText, darkMode && styles.darkText]}>This month⌄</Text></Pressable></View>
    <View style={styles.balanceCard}><View style={styles.balanceGlowOne} /><View style={styles.balanceGlowTwo} /><View style={styles.balanceCardContent}><View><Text style={styles.cardOverline}>TOTAL BALANCE</Text><Text style={styles.balance}>{money(184250)}</Text><Text style={styles.positive}>{monthlyComparison.changePercent >= 0 ? "↑" : "↓"} {Math.abs(monthlyComparison.changePercent).toFixed(1)}% spending vs last month</Text></View><View style={styles.balanceRing}><Text style={styles.ringValue}>68%</Text><Text style={styles.ringLabel}>saved</Text></View></View></View>
    <View style={styles.statsRow}><Stat label="Income" value={money(275000)} color="#0f766e" icon="↗" /><Stat label="Spent" value={money(spent)} color="#c65353" icon="↘" /><Stat label="Left to spend" value={money(Math.max(0, 90000 - spent))} color="#2563eb" icon="◌" /></View>
    <SectionHeader title="Spending this month" action="View details" onPress={onOpenExpenses} />
    <View style={styles.chartCard}><View style={styles.chartBars}>{[42, 68, 51, 82, 61, 93, 73].map((height, index) => <View key={index} style={styles.barColumn}><View style={[styles.bar, { height }]} /><Text style={styles.barLabel}>{["M", "T", "W", "T", "F", "S", "S"][index]}</Text></View>)}</View><View style={styles.chartLegend}><Text style={styles.muted}>Budget used</Text><Text style={styles.chartAmount}>{money(spent)} <Text style={styles.muted}>of {money(90000)}</Text></Text></View></View>
    <SectionHeader title="Budget health" action="Manage budgets" onPress={() => Alert.alert("Budgets", "Budget rules can be managed from the full web app.")} />
    <View style={styles.budgetCard}><BudgetForecastRow title="Food & dining" expenses={expenses} limit={18000} color="#f4b183" /><BudgetForecastRow title="Transport" expenses={expenses} limit={10000} color="#78c7b5" /><BudgetForecastRow title="Shopping" expenses={expenses} limit={15000} color="#a99be8" /></View>
    <SectionHeader title="Recent transactions" action="See all" onPress={onOpenExpenses} />
    <TransactionList expenses={expenses.slice(0, 3)} onSelect={() => {}} />
    <SectionHeader title="Savings goals" action="See all" onPress={onOpenGoals} />
    <View style={styles.goalsPreview}>{goals.slice(0, 2).map((goal) => <GoalMini key={goal.id} goal={goal} />)}</View>
    <View style={styles.quickActions}><Pressable onPress={onAddExpense} style={styles.quickAction}><Text style={styles.quickActionIcon}>＋</Text><Text style={styles.quickActionText}>Expense</Text></Pressable><Pressable onPress={onVoiceExpense} style={[styles.quickAction, styles.voiceQuickAction]}><Text style={styles.quickActionIcon}>◉</Text><Text style={styles.quickActionText}>Voice</Text></Pressable><Pressable onPress={onReceipt} style={[styles.quickAction, styles.receiptQuickAction]}><Text style={styles.quickActionIcon}>▤</Text><Text style={styles.quickActionText}>Receipt</Text></Pressable><Pressable onPress={() => onNavigate("bills")} style={styles.quickAction}><Text style={styles.quickActionIcon}>□</Text><Text style={styles.quickActionText}>Bill</Text></Pressable></View>
  </ScrollView>;
}

function Expenses({ darkMode, expenses, onRefresh, refreshing, onAdd, onVoice, onReceipt, onSelect }: { darkMode: boolean; expenses: Expense[]; onRefresh: () => Promise<void>; refreshing: boolean; onAdd: () => void; onVoice: () => void; onReceipt: () => void; onSelect: (expense: Expense) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const filtered = expenses.filter((item) => item.title.toLowerCase().includes(query.toLowerCase()) && (filter === "All" || item.category === filter));
  return <ScrollView contentContainerStyle={[styles.scroll, darkMode && styles.darkScroll]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} colors={["#0f766e"]} />}>
    <View style={styles.pageIntroRow}><View><Text style={[styles.pageTitle, darkMode && styles.darkText]}>Your expenses</Text><Text style={styles.muted}>Track every rupee, build better habits.</Text></View><View style={styles.inlineActions}><Pressable onPress={onVoice} style={styles.voiceButton}><Text style={styles.voiceButtonText}>◉ Voice</Text></Pressable><Pressable onPress={onReceipt} style={styles.receiptButton}><Text style={styles.voiceButtonText}>▤ Scan</Text></Pressable></View></View>
    <View style={styles.expenseSummary}><View><Text style={styles.cardOverline}>JUNE SPENDING</Text><Text style={styles.summaryAmount}>{money(expenses.reduce((sum, item) => sum + item.amount, 0))}</Text></View><Text style={styles.summaryChange}>↓ 12% vs May</Text></View>
    <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="Search expenses" placeholderTextColor="#95a2b1" style={styles.searchInput} /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{["All", "Food & dining", "Housing", "Transport", "Groceries"].map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filterChip, filter === item && styles.filterChipActive]}><Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text></Pressable>)}</ScrollView>
    <View style={styles.listHeader}><Text style={styles.sectionTitle}>{filtered.length} transactions</Text><Pressable onPress={onAdd}><Text style={styles.link}>+ Add</Text></Pressable></View>
    <TransactionList expenses={filtered} onSelect={onSelect} emptyQuery={query} />
  </ScrollView>;
}

function Accounts({ darkMode }: { darkMode: boolean }) {
  return <ScrollView contentContainerStyle={[styles.scroll, darkMode && styles.darkScroll]}><View style={styles.pageIntro}><Text style={[styles.pageTitle, darkMode && styles.darkText]}>Accounts & cards</Text><Text style={styles.muted}>All your money in one clear view.</Text></View><View style={styles.netWorthCard}><Text style={styles.cardOverline}>NET WORTH</Text><Text style={styles.netWorth}>{money(438520)}</Text><Text style={styles.positive}>↑ 5.2% this month</Text></View><Text style={[styles.sectionTitle, darkMode && styles.darkText]}>Your accounts</Text><AccountCard title="HDFC Salary Account" type="Bank account" amount={money(184250)} icon="H" color="#315ca8" /><AccountCard title="SBI Cashback Card" type="Credit card · 18% used" amount={money(-26480)} icon="S" color="#0f766e" /><AccountCard title="Cash wallet" type="Cash" amount={money(3200)} icon="₹" color="#c27a2c" /><Pressable style={styles.outlineButton} onPress={() => Alert.alert("Add account", "Account setup is available in the full app.")}><Text style={styles.outlineButtonText}>＋ Add account or card</Text></Pressable></ScrollView>;
}

function Goals({ darkMode, goals, onAdd }: { darkMode: boolean; goals: Goal[]; onAdd: () => void }) {
  return <ScrollView contentContainerStyle={[styles.scroll, darkMode && styles.darkScroll]}><View style={styles.pageIntroRow}><View><Text style={[styles.pageTitle, darkMode && styles.darkText]}>Savings goals</Text><Text style={styles.muted}>Small steps become big milestones.</Text></View><Pressable onPress={onAdd} style={styles.smallAdd}><Text style={styles.smallAddText}>＋</Text></Pressable></View><View style={styles.goalsTotal}><Text style={styles.cardOverline}>TOTAL SAVED</Text><Text style={styles.summaryAmount}>{money(goals.reduce((sum, goal) => sum + goal.saved, 0))}</Text><Text style={styles.muted}>of {money(goals.reduce((sum, goal) => sum + goal.target, 0))} across {goals.length} goals</Text></View>{goals.map((goal) => <GoalCard key={goal.id} goal={goal} />)}</ScrollView>;
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: { username: string; fullName: string; role: string }) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!username || !password || (mode === "signup" && !fullName)) {
      Alert.alert("Missing details", "Complete the required fields before continuing.");
      return;
    }
    setBusy(true);
    try {
      const user = mode === "login"
        ? await login(username, password)
        : await signup(username, password, fullName, email);
      onAuthenticated(user);
    } catch (error) {
      Alert.alert("Unable to continue", error instanceof Error ? error.message : "The server could not be reached.");
    } finally {
      setBusy(false);
    }
  };
  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled"><Text style={styles.authMark}>◎</Text><Text style={styles.authTitle}>Budget Tracker</Text><Text style={styles.authSubtitle}>Your private financial workspace, wherever you go.</Text><View style={styles.authCard}><View style={styles.authTabs}><Pressable onPress={() => setMode("login")} style={[styles.authTab, mode === "login" && styles.authTabActive]}><Text style={[styles.authTabText, mode === "login" && styles.authTabTextActive]}>Sign in</Text></Pressable><Pressable onPress={() => setMode("signup")} style={[styles.authTab, mode === "signup" && styles.authTabActive]}><Text style={[styles.authTabText, mode === "signup" && styles.authTabTextActive]}>Create account</Text></Pressable></View>{mode === "signup" && <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="Alex Morgan" />}{mode === "signup" && <Field label="Email" value={email} onChangeText={setEmail} placeholder="alex@example.com" /> }<Field label="Username" value={username} onChangeText={setUsername} placeholder="Your username" /><Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" /><Pressable style={styles.primaryButton} onPress={() => void submit()} disabled={busy}><Text style={styles.primaryButtonText}>{busy ? "Connecting…" : mode === "login" ? "Sign in securely" : "Create account"}</Text></Pressable></View><Text style={styles.securityText}>Your session uses a signed bearer token and your financial records stay scoped to your account.</Text></ScrollView></SafeAreaView>;
}

function More({ darkMode, setDarkMode, notificationsEnabled, setNotificationsEnabled, biometricEnabled, setBiometricEnabled, onNavigate, onLogout, onSync, syncing }: { darkMode: boolean; setDarkMode: (value: boolean) => void; notificationsEnabled: boolean; setNotificationsEnabled: (value: boolean) => void; biometricEnabled: boolean; setBiometricEnabled: (value: boolean) => void; onNavigate: (screen: Screen) => void; onLogout: () => void; onSync: () => void; syncing: boolean }) {
  const items: { label: string; detail: string; icon: string; screen: Screen }[] = [
    { label: "Bills & subscriptions", detail: "Never miss a payment", icon: "▣", screen: "bills" },
    { label: "Payments", detail: "Credit card payments", icon: "↗", screen: "payments" },
    { label: "Transfers", detail: "Move money between accounts", icon: "⇄", screen: "transfers" },
    { label: "Income", detail: "Salary and other income", icon: "↙", screen: "income" },
    { label: "Loans & insurance", detail: "Repayments and policies", icon: "◈", screen: "loans" },
    { label: "Budget rules", detail: "Thresholds and alerts", icon: "◒", screen: "budgets" },
    { label: "Categories", detail: "Organize your spending", icon: "⌘", screen: "categories" },
    { label: "Investments", detail: "Portfolio and transactions", icon: "↗", screen: "investments" },
    { label: "Rewards", detail: "Track points and redemptions", icon: "✦", screen: "rewards" },
    { label: "Reports & insights", detail: "Visualize your finances", icon: "◒", screen: "visualize" },
    { label: "Calendar", detail: "Upcoming financial events", icon: "□", screen: "calendar" },
    { label: "Reconciliation", detail: "Review account differences", icon: "✓", screen: "reconciliation" },
    { label: "Import / export", detail: "Move your data anytime", icon: "⇩", screen: "import" },
    { label: "Household", detail: "Share with family members", icon: "♧", screen: "household" },
    { label: "Net-worth history", detail: "Track your financial progress", icon: "⌁", screen: "netWorth" },
    { label: "About", detail: "Privacy and app information", icon: "i", screen: "about" },
  ];
  const addCalendarEvent = async () => {
    try {
      const permission = await Calendar.requestCalendarPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Calendar permission needed", "Allow calendar access to add bill reminders.");
        return;
      }
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const calendar = calendars.find((item) => item.allowsModifications);
      if (!calendar) throw new Error("No writable calendar is available.");
      const startDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      startDate.setHours(9, 0, 0, 0);
      await Calendar.createEventAsync(calendar.id, {
        title: "Budget Tracker bill reminder",
        startDate,
        endDate: new Date(startDate.getTime() + 30 * 60 * 1000),
        notes: "Review upcoming bills in Budget Tracker.",
        alarms: [{ relativeOffset: 0 }],
      });
      Alert.alert("Calendar reminder added", "A bill reminder was added for tomorrow.");
    } catch (error) {
      Alert.alert("Could not add calendar reminder", error instanceof Error ? error.message : "Calendar access failed.");
    }
  };
  return <ScrollView contentContainerStyle={styles.scroll}><View style={styles.pageIntro}><Text style={styles.pageTitle}>More</Text><Text style={styles.muted}>Tools to keep your finances organized.</Text></View><Pressable style={styles.syncButton} onPress={onSync}><Text style={styles.syncButtonText}>{syncing ? "Syncing with your account…" : "↻ Sync with web app"}</Text></Pressable><Pressable style={styles.calendarButton} onPress={() => void addCalendarEvent()}><Text style={styles.calendarButtonText}>□ Add bill reminder to calendar</Text></Pressable><View style={styles.moreCard}>{items.map((item) => <Pressable key={item.label} style={styles.moreRow} onPress={() => onNavigate(item.screen)}><View style={styles.moreIcon}><Text style={styles.moreIconText}>{item.icon}</Text></View><View style={styles.moreCopy}><Text style={styles.moreLabel}>{item.label}</Text><Text style={styles.muted}>{item.detail}</Text></View><Text style={styles.chevron}>›</Text></Pressable>)}<View style={styles.moreRow}><View style={styles.moreIcon}><Text style={styles.moreIconText}>◐</Text></View><View style={styles.moreCopy}><Text style={styles.moreLabel}>Dark mode</Text><Text style={styles.muted}>Use a darker appearance</Text></View><Switch value={darkMode} onValueChange={setDarkMode} trackColor={{ false: "#d8dee8", true: "#86c9bd" }} thumbColor={darkMode ? "#0f766e" : "#fff"} /></View><View style={styles.moreRow}><View style={styles.moreIcon}><Text style={styles.moreIconText}>♢</Text></View><View style={styles.moreCopy}><Text style={styles.moreLabel}>Device notifications</Text><Text style={styles.muted}>Receive alerts outside the app</Text></View><Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} trackColor={{ false: "#d8dee8", true: "#86c9bd" }} thumbColor={notificationsEnabled ? "#0f766e" : "#fff"} /></View><View style={styles.moreRow}><View style={styles.moreIcon}><Text style={styles.moreIconText}>◉</Text></View><View style={styles.moreCopy}><Text style={styles.moreLabel}>Biometric app lock</Text><Text style={styles.muted}>Protect your financial data on this device</Text></View><Switch value={biometricEnabled} onValueChange={setBiometricEnabled} trackColor={{ false: "#d8dee8", true: "#86c9bd" }} thumbColor={biometricEnabled ? "#0f766e" : "#fff"} /></View></View><Pressable style={styles.signOutButton} onPress={onLogout}><Text style={styles.signOutText}>Sign out securely</Text></Pressable><View style={styles.privacy}><Text style={styles.privacyTitle}>Private by design</Text><Text style={styles.muted}>Your data stays yours. Budget Tracker does not read bank SMS, scrape statements, or silently send your financial data anywhere.</Text></View></ScrollView>;
}

function ModuleScreen({ darkMode, module, items, household, onHouseholdChange, onRefresh, refreshing, onAdd, onUpdate, onDelete, onExport, onImport }: { darkMode: boolean; module: ModuleKey; items: ModuleItem[]; household: { role: "owner" | "member" | "none"; members: { email: string; status: string }[] }; onHouseholdChange: (value: { role: "owner" | "member" | "none"; members: { email: string; status: string }[] }) => void; onRefresh: () => Promise<void>; refreshing: boolean; onAdd: (item: ModuleItem) => void; onUpdate: (id: string, patch: Partial<ModuleItem>) => void; onDelete: (id: string) => void; onExport: () => void; onImport: () => void }) {
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ModuleItem | null>(null);
  const filtered = items.filter((item) => `${item.title} ${item.detail}`.toLowerCase().includes(query.toLowerCase()));
  const isReadOnly = module === "calendar" || module === "visualize" || module === "export" || module === "import" || module === "about" || module === "netWorth";
  const invite = async () => {
    const email = await promptText("Invite household member", "Enter their email address");
    if (!email?.trim()) return;
    try {
      const result = await inviteHouseholdMember(email.trim());
      const link = `budget-tracker://accept-invite?token=${result.inviteToken}`;
      const uri = `${FileSystem.Paths.cache}budget-tracker-invite.txt`;
      await FileSystem.writeAsStringAsync(uri, link);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { dialogTitle: "Share household invitation" });
      Alert.alert("Invitation created", link);
    } catch (error) {
      Alert.alert("Invitation failed", error instanceof Error ? error.message : "Could not create invitation");
    }
  };
  const leave = async () => {
    try { await leaveHousehold(); onHouseholdChange({ role: "none", members: [] }); } catch (error) { Alert.alert("Could not leave household", error instanceof Error ? error.message : "Request failed"); }
  };
  const accept = async () => {
    const token = await promptText("Accept invitation", "Paste the invitation token");
    if (!token?.trim()) return;
    try {
      await acceptHouseholdInvite(token.trim());
      const current = await fetchHousehold();
      onHouseholdChange({ role: current.role, members: current.household?.members ?? [] });
      Alert.alert("Invitation accepted", "The shared household is now available.");
    } catch (error) {
      Alert.alert("Could not accept invitation", error instanceof Error ? error.message : "Request failed");
    }
  };
  return <ScrollView contentContainerStyle={[styles.scroll, darkMode && styles.darkScroll]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} colors={["#0f766e"]} />}><View style={styles.pageIntroRow}><View><Text style={[styles.pageTitle, darkMode && styles.darkText]}>{moduleLabels[module]}</Text><Text style={styles.muted}>{moduleDescription(module)}</Text></View>{!isReadOnly && <Pressable onPress={() => setShowForm(true)} style={styles.smallAdd}><Text style={styles.smallAddText}>＋</Text></Pressable>}</View>{module === "household" && <View style={styles.householdCard}><Text style={styles.sectionTitle}>{household.role === "member" ? "Shared household" : "Household access"}</Text><Text style={styles.muted}>{household.role === "member" ? "You are viewing another owner's shared data." : "Invite people with full access to this workspace."}</Text>  {household.role !== "member" && <Pressable style={styles.primaryButton} onPress={() => void invite()}><Text style={styles.primaryButtonText}>Invite by email</Text></Pressable>}{household.role === "none" && <Pressable style={styles.secondaryButton} onPress={() => void accept()}><Text style={styles.secondaryButtonText}>Accept invitation</Text></Pressable>}{household.members.map((member) => <View key={member.email} style={styles.memberRow}><View style={styles.moduleCopy}><Text style={styles.transactionTitle}>{member.email}</Text><Text style={styles.muted}>{member.status}</Text></View><Pressable onPress={() => void removeHouseholdMember(member.email).then(() => onHouseholdChange({ ...household, members: household.members.filter((item) => item.email !== member.email) }))}><Text style={styles.deleteButtonText}>×</Text></Pressable></View>)}{household.role === "member" && <Pressable style={styles.secondaryButton} onPress={() => void leave()}><Text style={styles.secondaryButtonText}>Leave household</Text></Pressable>}</View>}{(module === "import" || module === "export") && <View style={styles.actionRow}><Pressable style={styles.primaryButton} onPress={module === "export" ? onExport : onImport}><Text style={styles.primaryButtonText}>{module === "export" ? "Export JSON" : "Import CSV / JSON"}</Text></Pressable></View>}<View style={styles.moduleSummary}><Text style={styles.cardOverline}>{module === "visualize" ? "THIS MONTH" : "TOTAL RECORDS"}</Text><Text style={styles.summaryAmount}>{module === "visualize" ? money(items.reduce((sum, item) => sum + (item.amount ?? 0), 0)) : items.length}</Text><Text style={styles.muted}>{module === "budgets" ? "rules currently configured" : module === "reconciliation" ? "items waiting for review" : "local records in this module"}</Text></View><View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder={`Search ${moduleLabels[module].toLowerCase()}`} placeholderTextColor="#95a2b1" style={styles.searchInput} /></View><View style={styles.moduleCard}>{filtered.map((item) => <View key={item.id} style={styles.moduleRow}><Pressable onPress={() => item.status && (module === "bills" || module === "budgets" || module === "reconciliation") ? onUpdate(item.id, { status: item.status === "Paid" || item.status === "Completed" ? "Pending" : "Paid", enabled: !item.enabled }) : undefined} style={styles.moduleTouch}><View style={styles.moreIcon}><Text style={styles.moreIconText}>{item.title.slice(0, 1)}</Text></View><View style={styles.moduleCopy}><Text style={styles.transactionTitle}>{item.title}</Text><Text style={styles.muted}>{item.detail}</Text></View><View style={styles.moduleValue}>{typeof item.amount === "number" && <Text style={styles.transactionAmount}>{money(item.amount)}</Text>}<Text style={[styles.statusText, item.status === "Paid" || item.status === "Completed" || item.status === "Active" || item.enabled ? styles.statusPositive : styles.statusPending]}>{item.status}</Text></View></Pressable><Pressable onPress={() => Alert.alert("Delete record", `Delete ${item.title}?`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => onDelete(item.id) }])} style={styles.deleteButton}><Text style={styles.deleteButtonText}>×</Text></Pressable></View>)}</View>{!filtered.length && <View style={styles.empty}><Text style={styles.sectionTitle}>No records found</Text><Text style={styles.muted}>Try another search or add a new record.</Text></View>}{showForm && <ModuleForm module={module} onClose={() => setShowForm(false)} onSave={(item) => { onAdd(item); setShowForm(false); }} />}</ScrollView>;
}

function ReceiptScanner({ initialImageUri, onClose, onSave }: { initialImageUri?: string | null; onClose: () => void; onSave: (expense: Expense) => void }) {
  const [busy, setBusy] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const parsed = useMemo(() => parseReceiptText(recognizedText), [recognizedText]);
  const recognize = async (uri: string) => {
    const lines = await TextExtractor.extractTextFromImage(uri);
    setRecognizedText(lines.join("\n"));
    if (!lines.length) Alert.alert("No text found", "Try a flatter, brighter photo of the receipt.");
  };
  useEffect(() => {
    if (!initialImageUri) return;
    setBusy(true);
    void recognize(initialImageUri)
      .catch((error: unknown) => Alert.alert("Receipt scan failed", error instanceof Error ? error.message : "Try importing the image again."))
      .finally(() => setBusy(false));
  }, [initialImageUri]);
  const scan = async () => {
    setBusy(true);
    setRecognizedText("");
    try {
      if (!CameraView.isDocumentScannerAvailable) {
        Alert.alert("Scanner unavailable", "Use a development build on a device with a supported document scanner.");
        return;
      }
      const result = await CameraView.scanDocumentAsync({ requestPdf: false, quality: 0.9 });
      const uri = result?.pages?.[0];
      if (!uri) return;
      await recognize(uri);
    } catch (error) {
      Alert.alert("Receipt scan failed", error instanceof Error ? error.message : "Try again or enter the expense manually.");
    } finally {
      setBusy(false);
    }
  };
  return <FormSheet title="Scan receipt" onClose={onClose}>
    <Text style={styles.formHint}>Capture a receipt and review the detected merchant, category, and total before saving.</Text>
    <Pressable onPress={() => void scan()} style={styles.receiptScanButton} disabled={busy}><Text style={styles.voiceListeningIcon}>▤</Text><Text style={styles.voiceListeningText}>{busy ? "Reading receipt…" : "Scan with camera"}</Text></Pressable>
    {!!recognizedText && <View style={styles.transcriptBox}><Text style={styles.transcriptText}>{recognizedText.slice(0, 600)}</Text></View>}
    {parsed && <View style={styles.voicePreview}><Text style={styles.cardOverline}>READY TO ADD</Text><Text style={styles.voicePreviewTitle}>{parsed.title}</Text><Text style={styles.muted}>{parsed.category} · {money(parsed.amount)}</Text></View>}
    <Pressable style={styles.primaryButton} disabled={!parsed} onPress={() => parsed && onSave({ id: "", ...parsed })}><Text style={styles.primaryButtonText}>{parsed ? "Confirm and save" : "Scan a receipt first"}</Text></Pressable>
  </FormSheet>;
}

function VoiceExpenseForm({ onClose, onSave }: { onClose: () => void; onSave: (expense: Expense) => void }) {
  const [transcript, setTranscript] = useState("");
  const [recognizing, setRecognizing] = useState(false);
  const parsed = useMemo(() => parseVoiceExpense(transcript), [transcript]);
  useSpeechRecognitionEvent("start", () => setRecognizing(true));
  useSpeechRecognitionEvent("end", () => setRecognizing(false));
  useSpeechRecognitionEvent("result", (event) => setTranscript(event.results[0]?.transcript ?? ""));
  useSpeechRecognitionEvent("error", (event) => {
    setRecognizing(false);
    Alert.alert("Voice input unavailable", event.message || "Try again or enter the expense manually.");
  });
  const startListening = async () => {
    if (recognizing) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Microphone permission needed", "Allow microphone access to use voice expense entry.");
        return;
      }
      setTranscript("");
      ExpoSpeechRecognitionModule.start({ lang: "en-IN", interimResults: true, continuous: false, requiresOnDeviceRecognition: false });
    } catch (error) {
      Alert.alert("Voice input unavailable", error instanceof Error ? error.message : "Try entering the expense manually.");
    }
  };
  return <FormSheet title="Add by voice" onClose={() => { if (recognizing) ExpoSpeechRecognitionModule.stop(); onClose(); }}>
    <Text style={styles.formHint}>Say something like “spent 450 on dinner”. Nothing is saved until you confirm it.</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={recognizing ? "Stop listening" : "Start voice expense entry"} onPress={() => void startListening()} style={[styles.voiceListeningButton, recognizing && styles.voiceListeningActive]}><Text style={styles.voiceListeningIcon}>{recognizing ? "◌" : "◉"}</Text><Text style={styles.voiceListeningText}>{recognizing ? "Listening… tap to stop" : "Tap to speak"}</Text></Pressable>
    <Text style={styles.fieldLabel}>Transcript</Text>
    <View style={styles.transcriptBox}><Text style={transcript ? styles.transcriptText : styles.muted}>{transcript || "Your words will appear here."}</Text></View>
    {parsed && <View style={styles.voicePreview}><Text style={styles.cardOverline}>READY TO ADD</Text><Text style={styles.voicePreviewTitle}>{parsed.title}</Text><Text style={styles.muted}>{parsed.category} · {money(parsed.amount)}</Text></View>}
    <Pressable style={styles.primaryButton} disabled={!parsed} onPress={() => parsed && onSave({ id: "", ...parsed })}><Text style={styles.primaryButtonText}>{parsed ? "Confirm and save" : "Speak an expense first"}</Text></Pressable>
  </FormSheet>;
}

async function promptText(title: string, message: string) {
  return new Promise<string | null>((resolve) => {
    Alert.prompt(title, message, (value) => resolve(value), "plain-text");
  });
}

function DataTransferForm({ exportData, initialText, onImport, onClose }: { exportData: string; initialText?: string | null; onImport: (value: string) => void; onClose: () => void }) {
  const [value, setValue] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ImportedStatementRow[]>([]);
  useEffect(() => {
    const text = initialText ?? "";
    setValue(text);
    setFileName(text ? "Shared content" : "");
    try { setPreview(text ? parseStatementText(text) : []); } catch { setPreview([]); }
  }, [initialText]);
  const share = async () => {
    const uri = `${FileSystem.Paths.cache}budget-tracker-export.json`;
    await FileSystem.writeAsStringAsync(uri, exportData);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { dialogTitle: "Share Budget Tracker export" });
    else Alert.alert("Sharing unavailable", "Your device does not support native sharing.");
  };
  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "application/json", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "text/*"], copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    setFileName(asset.name);
    let content = "";
    if (/\.(xlsx|xls)$/i.test(asset.name)) {
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const workbook = XLSX.read(base64, { type: "base64", cellDates: true });
      content = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
    } else {
      content = await FileSystem.readAsStringAsync(asset.uri);
    }
    setValue(content);
    try { setPreview(parseStatementText(content, asset.name)); } catch { setPreview([]); }
  };
  return <View style={styles.modalBackdrop}><View style={styles.formSheet}><View style={styles.formHeader}><Text style={styles.formTitle}>Import bank statement</Text><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View><Text style={styles.muted}>Supports statements from any bank in CSV, Excel, JSON, or tab-delimited format. Common columns such as date, narration, debit, credit, amount, reference, and balance are detected automatically.</Text><View style={styles.actionRow}><Pressable style={styles.secondaryButton} onPress={() => void pick()}><Text style={styles.secondaryButtonText}>Choose statement</Text></Pressable><Pressable style={styles.secondaryButton} onPress={() => void share()}><Text style={styles.secondaryButtonText}>Share export</Text></Pressable></View>{fileName && <Text style={styles.importFile}>{fileName} · {preview.length} transactions detected</Text>}{preview.length > 0 && <View style={styles.importPreview}>{preview.slice(0, 3).map((row, index) => <View key={`${row.date}-${index}`} style={styles.previewRow}><Text style={styles.previewDate}>{row.date}</Text><Text style={styles.previewDetails}>{row.details}</Text><Text style={[styles.previewAmount, row.kind === "income" && styles.previewIncome]}>{row.kind === "income" ? "+" : "-"}{money(row.amount)}</Text></View>)}{preview.length > 3 && <Text style={styles.muted}>Showing first 3 of {preview.length} detected rows</Text>}</View>}<TextInput value={value} onChangeText={(text) => { setValue(text); try { setPreview(parseStatementText(text)); } catch { setPreview([]); } }} multiline style={styles.dataInput} textAlignVertical="top" /><View style={styles.actionRow}><Pressable style={styles.secondaryButton} onPress={onClose}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable><Pressable style={styles.primaryButton} disabled={!value.trim()} onPress={() => void onImport(value)}><Text style={styles.primaryButtonText}>Import transactions</Text></Pressable></View></View></View>;
}

function moduleDescription(module: ModuleKey) {
  const descriptions: Record<ModuleKey, string> = { bills: "Track due dates and recurring payments.", payments: "Record payments against your cards.", transfers: "Move money between your accounts.", income: "Keep salary and other inflows organized.", loans: "Track principal, interest, and repayments.", insurance: "Manage policies and premium payments.", budgets: "Set thresholds and get spending alerts.", categories: "Manage your spending categories.", investments: "Track holdings and current value.", rewards: "Monitor earned, redeemed, and expired points.", subscriptions: "Keep recurring services visible.", reconciliation: "Review and reconcile account activity.", calendar: "See bills, payments, and financial events.", visualize: "Understand trends and spending patterns.", import: "Bring records into Budget Tracker.", export: "Download your financial records.", household: "Manage shared household access.", netWorth: "Review snapshots of your financial position.", about: "Privacy, version, and app information." }; return descriptions[module];
}

function ModuleForm({ module, onClose, onSave }: { module: ModuleKey; onClose: () => void; onSave: (item: ModuleItem) => void }) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [amount, setAmount] = useState("");
  return <View style={styles.inlineForm}><View style={styles.formHeader}><Text style={styles.formTitle}>Add {moduleLabels[module].toLowerCase()}</Text><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View><Field label="Name" value={title} onChangeText={setTitle} placeholder="Enter a name" /><Field label="Details" value={detail} onChangeText={setDetail} placeholder="Optional details" /><Field label="Amount (optional)" value={amount} onChangeText={setAmount} placeholder="₹ 0" keyboardType="numeric" /><Pressable style={styles.primaryButton} onPress={() => title ? onSave({ id: "", title, detail: detail || "Added just now", amount: amount ? Number(amount) : undefined, status: module === "categories" ? "Active" : "Pending" }) : Alert.alert("Add a name", "Enter a name before saving.")}><Text style={styles.primaryButtonText}>Save record</Text></Pressable></View>;
}

function TransactionList({ expenses, onSelect, emptyQuery }: { expenses: Expense[]; onSelect: (expense: Expense) => void; emptyQuery?: string }) {
  if (!expenses.length) return <View style={styles.empty}><Text style={styles.emptyIcon}>⌕</Text><Text style={styles.sectionTitle}>No expenses found</Text><Text style={styles.muted}>Try another search or reset your filters.</Text></View>;
  return <View style={styles.transactionCard}>{expenses.map((expense) => <Pressable key={expense.id} onPress={() => onSelect(expense)} style={styles.transactionRow}><View style={[styles.categoryIcon, { backgroundColor: `${categoryColors[expense.category] ?? "#a6b3c2"}44` }]}><Text style={styles.categoryIconText}>{expense.title.slice(0, 1)}</Text></View><View style={styles.transactionCopy}><Text style={styles.transactionTitle}>{expense.title}</Text><Text style={styles.muted}>{expense.category} · {expense.date}{expense.isEmi ? " · Tap for schedule" : ""}</Text></View><View><Text style={styles.transactionAmount}>-{money(expense.amount)}</Text>{expense.isEmi && <Text style={styles.emiTag}>EMI</Text>}</View></Pressable>)}</View>;
}

function TransactionRow({ label, value, color }: { label: string; value: string; color: string }) { return <View style={styles.transactionRow}><View style={[styles.categoryIcon, { backgroundColor: `${color}33` }]}><Text style={[styles.categoryIconText, { color }]}>{label.slice(0, 1)}</Text></View><Text style={styles.transactionCopy}>{label}</Text><Text style={styles.transactionAmount}>{value}</Text></View>; }
function Stat({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) { return <View style={styles.stat}><Text style={[styles.statIcon, { color }]}>{icon}</Text><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>; }
function SectionHeader({ title, action, onPress }: { title: string; action: string; onPress: () => void }) { return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text><Pressable onPress={onPress}><Text style={styles.link}>{action} ›</Text></Pressable></View>; }
function BudgetForecastRow({ title, expenses, limit, color }: { title: string; expenses: Expense[]; limit: number; color: string }) { const forecast = forecastBudget({ title, budgetAmount: limit, budgetMode: "monthly" }, expenses); const percentage = Math.min(100, forecast.percentage); return <View style={styles.budgetRow}><View style={styles.budgetLabels}><Text style={styles.budgetLabel}>{title}</Text><Text style={[styles.muted, forecast.willExceed && styles.negative]}>{money(forecast.spent)} / {money(limit)}{forecast.willExceed ? " · forecast over" : ""}</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: forecast.willExceed ? "#c65353" : color }]} /></View></View>; }
function GoalMini({ goal }: { goal: Goal }) { return <View style={styles.goalMini}><View style={[styles.goalDot, { backgroundColor: goal.color }]} /><Text style={styles.goalMiniTitle}>{goal.title}</Text><Text style={styles.goalMiniValue}>{Math.round((goal.saved / goal.target) * 100)}%</Text></View>; }
function GoalCard({ goal }: { goal: Goal }) { const percentage = Math.round((goal.saved / goal.target) * 100); return <View style={styles.goalCard}><View style={styles.goalHeader}><View style={[styles.goalLargeIcon, { backgroundColor: `${goal.color}20` }]}><Text style={[styles.goalLargeIconText, { color: goal.color }]}>◎</Text></View><View style={styles.goalCardCopy}><Text style={styles.goalTitle}>{goal.title}</Text><Text style={styles.muted}>{money(goal.saved)} saved of {money(goal.target)}</Text></View><Text style={[styles.goalPercentage, { color: goal.color }]}>{percentage}%</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: goal.color }]} /></View><Text style={styles.goalHint}>{money(goal.target - goal.saved)} left to reach your goal</Text></View>; }
function AccountCard({ title, type, amount, icon, color }: { title: string; type: string; amount: string; icon: string; color: string }) { return <View style={styles.accountCard}><View style={[styles.accountIcon, { backgroundColor: color }]}><Text style={styles.accountIconText}>{icon}</Text></View><View style={styles.accountCopy}><Text style={styles.transactionTitle}>{title}</Text><Text style={styles.muted}>{type}</Text></View><Text style={[styles.accountAmount, amount.startsWith("-") && styles.negative]}>{amount}</Text></View>; }

function ExpenseForm({ accounts, onClose, onSave }: { accounts: AccountOption[]; onClose: () => void; onSave: (expense: Expense) => void }) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food & dining");
  const [cardId, setCardId] = useState(accounts[0]?.id ?? "");
  useEffect(() => {
    if (!cardId && accounts.length) setCardId(accounts[0].id);
  }, [accounts, cardId]);
  return <FormSheet title="Add expense" onClose={onClose}>
    <Text style={styles.formHint}>Log it now so your dashboard stays honest.</Text>
    <Field label="What did you spend on?" value={title} onChangeText={setTitle} placeholder="e.g. Coffee, rent, groceries" />
    <Field label="Amount" value={amount} onChangeText={setAmount} placeholder="₹ 0" keyboardType="numeric" />
    <Text style={styles.fieldLabel}>Account</Text>
    {accounts.length
      ? <View style={styles.formChips}>{accounts.map((account) => <Pressable key={account.id} onPress={() => setCardId(account.id)} style={[styles.formChip, cardId === account.id && styles.formChipActive]}><Text style={[styles.formChipText, cardId === account.id && styles.formChipTextActive]}>{account.title}</Text></Pressable>)}</View>
      : <Text style={styles.formHint}>Add an account in the web app before recording an expense.</Text>}
    <Text style={styles.fieldLabel}>Category</Text>
    <View style={styles.formChips}>{["Food & dining", "Housing", "Transport", "Groceries"].map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.formChip, category === item && styles.formChipActive]}><Text style={[styles.formChipText, category === item && styles.formChipTextActive]}>{item}</Text></Pressable>)}</View>
    <Pressable style={styles.primaryButton} onPress={() => {
      if (!cardId) {
        Alert.alert("Account required", "Add an account in the web app and sync before saving an expense.");
      } else if (title && Number(amount) > 0) {
        onSave({ id: "", title, category, amount: Number(amount), date: "Just now", cardId });
      } else {
        Alert.alert("Add some details", "Enter a description and a valid amount.");
      }
    }}><Text style={styles.primaryButtonText}>Save expense</Text></Pressable>
  </FormSheet>;
}
function GoalForm({ onClose, onSave }: { onClose: () => void; onSave: (goal: Goal) => void }) { const [title, setTitle] = useState(""); const [target, setTarget] = useState(""); return <FormSheet title="New savings goal" onClose={onClose}><Text style={styles.formHint}>Give your next milestone a name and a target.</Text><Field label="Goal name" value={title} onChangeText={setTitle} placeholder="e.g. New phone" /><Field label="Target amount" value={target} onChangeText={setTarget} placeholder="₹ 0" keyboardType="numeric" /><Pressable style={styles.primaryButton} onPress={() => title && Number(target) > 0 ? onSave({ id: "", title, target: Number(target), saved: 0, color: "#2563eb" }) : Alert.alert("Add some details", "Enter a goal name and target amount.")}><Text style={styles.primaryButtonText}>Create goal</Text></Pressable></FormSheet>; }
function FormSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <View style={styles.modalBackdrop}><View style={styles.formSheet}><View style={styles.formHeader}><Text style={styles.formTitle}>{title}</Text><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>{children}</View></View>; }
function Field({ label, value, onChangeText, placeholder, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: "numeric" }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9aa7b5" keyboardType={keyboardType} style={styles.input} /></View>; }
function EmiSchedule({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const months = expense.months ?? 12;
  const schedule = getEmiSchedule(expense.amount, 0, months, expense.date);
  const monthlyPayment = schedule[0]?.paymentAmount ?? calcMonthlyEmi(expense.amount, 0, months);
  return <View style={styles.modalBackdrop}><View style={styles.formSheet}><View style={styles.formHeader}><View><Text style={styles.formTitle}>EMI schedule</Text><Text style={styles.muted}>{expense.title} · {months} months</Text></View><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View><View style={styles.emiSummary}><Text style={styles.cardOverline}>MONTHLY PAYMENT</Text><Text style={styles.summaryAmount}>{money(monthlyPayment)}</Text><Text style={styles.muted}>{schedule.filter((entry) => entry.status === "completed").length} paid · {schedule.filter((entry) => entry.status !== "completed").length} remaining</Text></View><ScrollView style={styles.schedule}>{schedule.map((entry) => <View key={entry.paymentNumber} style={styles.scheduleRow}><View style={[styles.scheduleDot, entry.status === "completed" && styles.scheduleDotDone]} /><Text style={styles.scheduleMonth}>Installment {entry.paymentNumber}<Text style={styles.muted}> · {entry.dueDate}</Text></Text><Text style={[styles.scheduleStatus, entry.status === "completed" && styles.scheduleDone]}>{entry.status}</Text><Text style={styles.scheduleAmount}>{money(entry.paymentAmount)}</Text></View>)}</ScrollView></View></View>;
}
function PressableScale({ children, onPress, style, accessibilityLabel }: { children: React.ReactNode; onPress: () => void; style?: object; accessibilityLabel?: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (toValue: number) => Animated.spring(scale, { toValue, useNativeDriver: true, damping: 16, stiffness: 260 }).start();
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} onPressIn={() => animate(0.94)} onPressOut={() => animate(1)}><Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View></Pressable>;
}

function BottomNav({ screen, setScreen }: { screen: Screen; setScreen: (screen: Screen) => void }) { return <View style={styles.bottomNav}>{[["dashboard", "⌂", "Home"], ["expenses", "◔", "Expenses"], ["accounts", "▣", "Accounts"], ["goals", "◎", "Goals"], ["more", "☷", "More"]].map(([key, icon, label]) => <PressableScale key={key} accessibilityLabel={`Open ${label}`} onPress={() => setScreen(key as Screen)} style={styles.navItem}><Animated.View style={[styles.navIndicator, screen === key && styles.navIndicatorActive]} /><Text style={[styles.navIcon, screen === key && styles.navActive]}>{icon}</Text><Text style={[styles.navLabel, screen === key && styles.navActive]}>{label}</Text></PressableScale>)}</View>; }

const styles = StyleSheet.create({
  overline: { color: "#0f766e", fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  topTitle: { color: "#102a43", fontSize: 22, fontWeight: "800", marginTop: 4, letterSpacing: -0.3 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#dff1ed", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff" },
  avatarText: { color: "#0f766e", fontWeight: "800", fontSize: 16 },
  scroll: { padding: 20, paddingBottom: 40 },
  darkScroll: { backgroundColor: "#0d141c" },
  monthRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  safeArea: { flex: 1, backgroundColor: "#f4f7fb" },
  darkSafeArea: { backgroundColor: "#0d141c" },
  app: { flex: 1, backgroundColor: "#f4f7fb" },
  darkApp: { backgroundColor: "#0d141c" },
  darkText: { color: "#e5edf5" },
  darkControl: { backgroundColor: "#162431", borderColor: "#263746" },
  body: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  lockScreen: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  lockIcon: { color: "#0f766e", fontSize: 48, marginBottom: 12 },
  skeletonPage: { flex: 1, backgroundColor: "#f4f7fb" },
  skeletonBoot: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  skeletonBlock: { backgroundColor: "#dce5eb" },
  darkSkeletonBlock: { backgroundColor: "#30424e" },
  darkSkeletonSurface: { backgroundColor: "#162431" },
  skeletonHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  skeletonHero: { backgroundColor: "#0b756c", borderRadius: 24, minHeight: 150, padding: 22, justifyContent: "center", gap: 10, marginBottom: 14, overflow: "hidden" },
  skeletonHeroCircle: { position: "absolute", right: 22, top: 48, width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  skeletonStats: { flexDirection: "row", gap: 9, marginBottom: 22 },
  skeletonStat: { flex: 1, minHeight: 66, borderRadius: 16, backgroundColor: "#fff", padding: 12, justifyContent: "space-between" },
  skeletonCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginTop: 12, gap: 12 },
  skeletonRow: { flexDirection: "row", alignItems: "center", gap: 11, minHeight: 48 },
  skeletonRowCopy: { flex: 1, gap: 7 },
  skeletonRowAmount: { alignItems: "flex-end", gap: 7 },
  skeletonChips: { flexDirection: "row", gap: 8, marginTop: 14, marginBottom: 2 },
  loadingTitle: { color: "#17324d", fontSize: 20, fontWeight: "800", marginBottom: 7 },
  authContent: { flexGrow: 1, justifyContent: "center", padding: 24 },
  authMark: { color: "#0f766e", fontSize: 55, textAlign: "center" },
  authTitle: { color: "#17324d", fontSize: 31, fontWeight: "800", textAlign: "center", marginTop: 4 },
  authSubtitle: { color: "#8391a0", fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8, marginBottom: 25 },
  authCard: { backgroundColor: "#fff", borderRadius: 24, padding: 20, shadowColor: "#16324a", shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 7 }, elevation: 4 },
  authTabs: { flexDirection: "row", backgroundColor: "#edf3f4", borderRadius: 13, padding: 4, marginBottom: 21 },
  authTab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10 },
  authTabActive: { backgroundColor: "#fff" },
  authTabText: { color: "#8998a7", fontSize: 12, fontWeight: "700" },
  authTabTextActive: { color: "#0f766e" },
  securityText: { color: "#8492a1", fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 18 },
  signOutButton: { borderWidth: 1, borderColor: "#e1b4a9", borderRadius: 14, padding: 15, alignItems: "center", marginTop: 18 },
  signOutText: { color: "#bd564b", fontSize: 13, fontWeight: "800" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingHorizontal: 20, paddingTop: 8 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  bellButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#e1e8ef", shadowColor: "#16324a", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  bellText: { color: "#52687b", fontSize: 22 },
  alertBadge: { position: "absolute", right: -3, top: -3, minWidth: 17, height: 17, paddingHorizontal: 3, borderRadius: 9, backgroundColor: "#c65353", alignItems: "center", justifyContent: "center" },
  alertBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  monthLabel: { color: "#17324d", fontWeight: "800", fontSize: 16 },
  muted: { color: "#8391a0", fontSize: 12, lineHeight: 18 },
  monthButton: { backgroundColor: "#fff", borderRadius: 13, borderWidth: 1, borderColor: "#dce3eb", paddingHorizontal: 12, paddingVertical: 9, shadowColor: "#17324d", shadowOpacity: 0.035, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  monthButtonText: { color: "#52687b", fontSize: 12, fontWeight: "700" },
  balanceCard: { backgroundColor: "#0b756c", borderRadius: 24, padding: 22, marginBottom: 14, overflow: "hidden", shadowColor: "#0b756c", shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  balanceCardContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", zIndex: 1 },
  balanceGlowOne: { position: "absolute", width: 170, height: 170, borderRadius: 85, backgroundColor: "rgba(255,255,255,0.07)", right: -52, top: -72 },
  balanceGlowTwo: { position: "absolute", width: 110, height: 110, borderRadius: 55, backgroundColor: "rgba(255,255,255,0.05)", right: 54, bottom: -72 },
  cardOverline: { color: "#94d5c9", fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  balance: { color: "#fff", fontSize: 30, fontWeight: "800", marginTop: 5 },
  positive: { color: "#aee4d9", fontSize: 11, marginTop: 5 },
  balanceRing: { borderWidth: 5, borderColor: "#a5ded3", borderLeftColor: "#3d978d", width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  ringValue: { color: "#fff", fontWeight: "800", fontSize: 18 },
  ringLabel: { color: "#b9e2d9", fontSize: 10 },
  statsRow: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 20, padding: 17, marginBottom: 24, justifyContent: "space-between", shadowColor: "#17324d", shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  stat: { flex: 1 },
  statIcon: { fontSize: 18, fontWeight: "800" },
  statLabel: { color: "#8492a1", fontSize: 11, marginTop: 5 },
  statValue: { color: "#17324d", fontSize: 13, fontWeight: "800", marginTop: 3 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, marginTop: 3 },
  sectionTitle: { color: "#17324d", fontSize: 16, fontWeight: "800" },
  link: { color: "#0f766e", fontSize: 12, fontWeight: "800" },
  chartCard: { backgroundColor: "#fff", borderRadius: 20, padding: 18, marginBottom: 24, shadowColor: "#17324d", shadowOpacity: 0.045, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  chartBars: { height: 120, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around" },
  barColumn: { alignItems: "center", justifyContent: "flex-end", height: "100%" },
  bar: { width: 22, backgroundColor: "#8dcfc3", borderRadius: 5, minHeight: 10 },
  barLabel: { color: "#95a2b1", fontSize: 10, marginTop: 8 },
  chartLegend: { borderTopWidth: 1, borderTopColor: "#edf0f4", marginTop: 12, paddingTop: 12, flexDirection: "row", justifyContent: "space-between" },
  chartAmount: { color: "#17324d", fontSize: 13, fontWeight: "800" },
  budgetCard: { backgroundColor: "#fff", borderRadius: 20, padding: 18, marginBottom: 24, shadowColor: "#17324d", shadowOpacity: 0.045, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  budgetRow: { marginBottom: 15 },
  budgetRowLast: { marginBottom: 0 },
  budgetLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: 7 },
  budgetLabel: { color: "#52687b", fontSize: 12, fontWeight: "700" },
  progressTrack: { height: 8, borderRadius: 5, backgroundColor: "#e8edf2", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 5 },
  transactionCard: { backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 16, marginBottom: 24, shadowColor: "#17324d", shadowOpacity: 0.045, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  transactionRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#edf0f4" },
  categoryIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", marginRight: 11 },
  categoryIconText: { color: "#536c7d", fontWeight: "800", fontSize: 15 },
  transactionCopy: { flex: 1 },
  transactionTitle: { color: "#27435a", fontSize: 13, fontWeight: "800" },
  transactionAmount: { color: "#17324d", fontSize: 13, fontWeight: "800", textAlign: "right" },
  emiTag: { color: "#c27a2c", fontSize: 9, fontWeight: "800", textAlign: "right", marginTop: 3 },
  goalsPreview: { backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 16, marginBottom: 18, shadowColor: "#17324d", shadowOpacity: 0.045, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  goalMini: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#edf0f4" },
  goalDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  goalMiniTitle: { color: "#52687b", flex: 1, fontSize: 13, fontWeight: "700" },
  goalMiniValue: { color: "#17324d", fontSize: 13, fontWeight: "800" },
  floatingAction: { backgroundColor: "#0b756c", borderRadius: 25, alignSelf: "center", flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 13, marginTop: 3, marginBottom: 5, shadowColor: "#0b756c", shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  quickActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 3, marginBottom: 18 },
  quickAction: { width: "23%", backgroundColor: "#fff", borderRadius: 17, paddingVertical: 13, alignItems: "center", borderWidth: 1, borderColor: "#e5ebf0", shadowColor: "#17324d", shadowOpacity: 0.05, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  voiceQuickAction: { borderColor: "#a9dcd3", backgroundColor: "#f0fbf8" },
  receiptQuickAction: { borderColor: "#d8c8f2", backgroundColor: "#f8f4ff" },
  quickActionIcon: { color: "#0f766e", fontSize: 20, fontWeight: "800" },
  quickActionText: { color: "#52687b", fontSize: 10, fontWeight: "700", marginTop: 4 },
  floatingPlus: { color: "#b9e2d9", fontSize: 21, marginRight: 8 },
  floatingText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  pageIntro: { marginBottom: 20 },
  pageIntroRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  pageTitle: { color: "#102a43", fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  expenseSummary: { backgroundColor: "#dff4ef", borderRadius: 20, padding: 19, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  summaryAmount: { color: "#17324d", fontSize: 27, fontWeight: "800", marginTop: 4 },
  summaryChange: { color: "#0f766e", fontSize: 12, fontWeight: "800" },
  searchBox: { backgroundColor: "#fff", borderRadius: 15, flexDirection: "row", alignItems: "center", paddingHorizontal: 13, marginBottom: 14, borderWidth: 1, borderColor: "#e1e7ee", shadowColor: "#17324d", shadowOpacity: 0.035, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  searchIcon: { color: "#7d8c9b", fontSize: 20 },
  searchInput: { flex: 1, height: 45, paddingHorizontal: 8, color: "#17324d", fontSize: 13 },
  filterRow: { gap: 7, paddingBottom: 18 },
  filterChip: { borderWidth: 1, borderColor: "#dce3eb", borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: "#fff" },
  filterChipActive: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  filterText: { color: "#718294", fontSize: 11, fontWeight: "700" },
  filterTextActive: { color: "#fff" },
  listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 9 },
  empty: { backgroundColor: "#fff", padding: 30, borderRadius: 20, alignItems: "center", borderWidth: 1, borderColor: "#edf1f5", shadowColor: "#17324d", shadowOpacity: 0.035, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  emptyIcon: { color: "#a3b0bd", fontSize: 32, marginBottom: 8 },
  netWorthCard: { backgroundColor: "#172f49", padding: 22, borderRadius: 24, marginBottom: 24, shadowColor: "#17324d", shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  netWorth: { color: "#fff", fontSize: 29, fontWeight: "800", marginTop: 4, marginBottom: 4 },
  accountCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", marginBottom: 11, shadowColor: "#17324d", shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  accountIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 12 },
  accountIconText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  accountCopy: { flex: 1 },
  accountAmount: { color: "#0f766e", fontSize: 14, fontWeight: "800" },
  negative: { color: "#c65353" },
  outlineButton: { borderWidth: 1, borderColor: "#0f766e", borderRadius: 11, padding: 14, alignItems: "center", marginTop: 9 },
  outlineButtonText: { color: "#0f766e", fontWeight: "800" },
  smallAdd: { backgroundColor: "#0f766e", width: 37, height: 37, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  smallAddText: { color: "#fff", fontSize: 23 },
  goalsTotal: { backgroundColor: "#fff", padding: 20, borderRadius: 20, marginBottom: 16, shadowColor: "#17324d", shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  goalCard: { backgroundColor: "#fff", padding: 19, borderRadius: 20, marginBottom: 13, shadowColor: "#17324d", shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  goalHeader: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  goalLargeIcon: { width: 45, height: 45, borderRadius: 14, justifyContent: "center", alignItems: "center", marginRight: 11 },
  goalLargeIconText: { fontSize: 26 },
  goalCardCopy: { flex: 1 },
  goalTitle: { color: "#27435a", fontWeight: "800", fontSize: 14, marginBottom: 3 },
  goalPercentage: { fontSize: 15, fontWeight: "800" },
  goalHint: { color: "#8391a0", fontSize: 11, marginTop: 9 },
  moreCard: { backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 16, shadowColor: "#17324d", shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  moreRow: { flexDirection: "row", alignItems: "center", paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#edf0f4" },
  moreIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: "#e6f4f1", alignItems: "center", justifyContent: "center", marginRight: 12 },
  moreIconText: { color: "#0f766e", fontSize: 16, fontWeight: "800" },
  moreCopy: { flex: 1 },
  moreLabel: { color: "#27435a", fontWeight: "800", fontSize: 13, marginBottom: 3 },
  chevron: { color: "#99a6b3", fontSize: 24 },
  privacy: { backgroundColor: "#fff6ed", borderRadius: 15, padding: 16, marginTop: 18 },
  privacyTitle: { color: "#8a5a36", fontWeight: "800", fontSize: 14, marginBottom: 5 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(12, 27, 40, .42)" },
  formSheet: { backgroundColor: "#f4f7fb", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: "88%" },
  alertSheet: { backgroundColor: "#f4f7fb", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: "78%" },
  alertRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 17, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#edf1f5" },
  alertDot: { width: 10, height: 10, borderRadius: 5, marginRight: 11 },
  alertHigh: { backgroundColor: "#c65353" },
  alertMedium: { backgroundColor: "#c27a2c" },
  alertInfo: { backgroundColor: "#2563eb" },
  alertCopy: { flex: 1 },
  alertTitle: { color: "#27435a", fontSize: 13, fontWeight: "800", marginBottom: 2 },
  snoozeText: { color: "#2563eb", fontSize: 10, fontWeight: "700", marginLeft: 8 },
  dismissText: { color: "#8391a0", fontSize: 10, fontWeight: "700", marginLeft: 8 },
  emptyAlert: { alignItems: "center", paddingVertical: 35 },
  emptyAlertIcon: { color: "#0f766e", fontSize: 34, fontWeight: "800", marginBottom: 8 },
  formHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 17 },
  formTitle: { color: "#17324d", fontSize: 21, fontWeight: "800" },
  close: { color: "#52687b", fontSize: 30, lineHeight: 27 },
  formHint: { color: "#8391a0", fontSize: 13, marginBottom: 20 },
  voiceButton: { backgroundColor: "#e0f5f0", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, marginTop: 2 },
  voiceButtonText: { color: "#0f766e", fontSize: 11, fontWeight: "800" },
  inlineActions: { flexDirection: "row", gap: 7, alignItems: "center" },
  receiptButton: { backgroundColor: "#f0eafa", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, marginTop: 2 },
  voiceListeningButton: { backgroundColor: "#e0f5f0", borderRadius: 20, minHeight: 112, alignItems: "center", justifyContent: "center", marginBottom: 20, borderWidth: 1, borderColor: "#b9e2d9" },
  voiceListeningActive: { backgroundColor: "#d8f3ec", borderColor: "#0f766e" },
  voiceListeningIcon: { color: "#0f766e", fontSize: 35, marginBottom: 6 },
  voiceListeningText: { color: "#0f766e", fontWeight: "800", fontSize: 14 },
  receiptScanButton: { backgroundColor: "#f0eafa", borderRadius: 20, minHeight: 112, alignItems: "center", justifyContent: "center", marginBottom: 20, borderWidth: 1, borderColor: "#d8c8f2" },
  transcriptBox: { minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: "#d8e0e9", backgroundColor: "#fbfcfd", padding: 14, marginBottom: 16, justifyContent: "center" },
  transcriptText: { color: "#17324d", fontSize: 14, lineHeight: 20 },
  voicePreview: { backgroundColor: "#eaf8f4", borderRadius: 16, padding: 15, marginBottom: 17 },
  voicePreviewTitle: { color: "#17324d", fontSize: 16, fontWeight: "800", marginTop: 5, marginBottom: 3 },
  calendarButton: { backgroundColor: "#eaf0fb", borderRadius: 15, padding: 15, alignItems: "center", marginBottom: 16 },
  calendarButtonText: { color: "#315ca8", fontSize: 13, fontWeight: "800" },
  field: { marginBottom: 16 },
  fieldLabel: { color: "#52687b", fontSize: 12, fontWeight: "800", marginBottom: 7, letterSpacing: 0.2 },
  input: { height: 51, borderWidth: 1, borderColor: "#d8e0e9", borderRadius: 14, backgroundColor: "#fbfcfd", paddingHorizontal: 14, color: "#17324d", fontSize: 14 },
  formChips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 18 },
  formChip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: "#d8e0e9", backgroundColor: "#fff" },
  formChipActive: { backgroundColor: "#0f766e", borderColor: "#0f766e" },
  formChipText: { color: "#708193", fontSize: 11, fontWeight: "700" },
  formChipTextActive: { color: "#fff" },
  primaryButton: { backgroundColor: "#0b756c", borderRadius: 14, height: 51, alignItems: "center", justifyContent: "center", marginTop: 2, shadowColor: "#0b756c", shadowOpacity: 0.14, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  primaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  secondaryButton: { flex: 1, backgroundColor: "#e8eef3", borderRadius: 14, height: 51, alignItems: "center", justifyContent: "center", marginTop: 2 },
  secondaryButtonText: { color: "#52687b", fontSize: 14, fontWeight: "800" },
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  dataInput: { minHeight: 220, maxHeight: 360, borderWidth: 1, borderColor: "#d8e0e9", borderRadius: 10, backgroundColor: "#fff", padding: 12, color: "#17324d", fontSize: 12, marginTop: 14, marginBottom: 14 },
  importFile: { color: "#0f766e", fontSize: 12, fontWeight: "800", marginTop: 14 },
  importPreview: { backgroundColor: "#fff", borderRadius: 11, padding: 10, marginTop: 10 },
  previewRow: { flexDirection: "row", alignItems: "center", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#edf0f4" },
  previewDate: { color: "#8391a0", fontSize: 10, width: 74 },
  previewDetails: { color: "#52687b", fontSize: 11, flex: 1 },
  previewAmount: { color: "#c65353", fontSize: 11, fontWeight: "800" },
  previewIncome: { color: "#0f766e" },
  emiSummary: { backgroundColor: "#e6f4f1", padding: 15, borderRadius: 13, marginBottom: 12 },
  schedule: { maxHeight: 380 },
  scheduleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "#e9edf2" },
  scheduleDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#d4dde5", marginRight: 10 },
  scheduleDotDone: { backgroundColor: "#0f766e" },
  scheduleMonth: { color: "#52687b", fontSize: 12, flex: 1 },
  scheduleStatus: { color: "#9aa7b5", fontSize: 11, marginRight: 10 },
  scheduleDone: { color: "#0f766e", fontWeight: "700" },
  scheduleAmount: { color: "#17324d", fontSize: 12, fontWeight: "800" },
  moduleSummary: { backgroundColor: "#dff4ef", borderRadius: 20, padding: 19, marginBottom: 18 },
  householdCard: { backgroundColor: "#fff", borderRadius: 20, padding: 18, marginBottom: 18, shadowColor: "#17324d", shadowOpacity: 0.045, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  memberRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#edf0f4" },
  moduleCard: { backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 16, shadowColor: "#17324d", shadowOpacity: 0.04, shadowRadius: 11, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  moduleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#edf0f4" },
  moduleTouch: { flex: 1, flexDirection: "row", alignItems: "center" },
  moduleCopy: { flex: 1 },
  moduleValue: { alignItems: "flex-end", maxWidth: 110 },
  deleteButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#fff0ee", alignItems: "center", justifyContent: "center", marginLeft: 8 },
  deleteButtonText: { color: "#bd564b", fontSize: 20, lineHeight: 20 },
  statusText: { fontSize: 10, fontWeight: "800", marginTop: 4 },
  statusPositive: { color: "#0f766e" },
  statusPending: { color: "#c27a2c" },
  inlineForm: { backgroundColor: "#fff", borderRadius: 20, padding: 18, marginTop: 18, borderWidth: 1, borderColor: "#dce4ec", shadowColor: "#17324d", shadowOpacity: 0.04, shadowRadius: 11, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  bottomNav: { height: 78, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#edf1f5", flexDirection: "row", justifyContent: "space-around", paddingTop: 9, paddingBottom: 8, shadowColor: "#17324d", shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -5 }, elevation: 8 },
  navItem: { alignItems: "center", flex: 1 },
  navIndicator: { width: 22, height: 3, borderRadius: 2, backgroundColor: "transparent", marginBottom: 5 },
  navIndicatorActive: { backgroundColor: "#0f766e" },
  navIcon: { color: "#9ba8b5", fontSize: 21, height: 27 },
  navLabel: { color: "#8896a5", fontSize: 10, fontWeight: "700" },
  navActive: { color: "#0f766e" },
  syncButton: { backgroundColor: "#0b756c", borderRadius: 16, padding: 15, alignItems: "center", marginBottom: 16, shadowColor: "#0b756c", shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  syncButtonText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  offlineBanner: { backgroundColor: "#fff2d6", paddingVertical: 7, paddingHorizontal: 15 },
  offlineText: { color: "#8a5a36", fontSize: 11, fontWeight: "700", textAlign: "center" },
  offlineAction: { color: "#0b756c", fontSize: 10, fontWeight: "800", textAlign: "center", marginTop: 3 },
  formHeaderInline: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 17 }
});
