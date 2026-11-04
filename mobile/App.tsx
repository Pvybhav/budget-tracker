import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { updateBudgetTrackerWidget } from "./widget-service";
import { useShareIntent } from "expo-share-intent";
import * as Notifications from "expo-notifications";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import * as Network from "expo-network";
import * as QuickActions from "expo-quick-actions";
import * as LocalAuthentication from "expo-local-authentication";
import * as FileSystem from "expo-file-system/legacy";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, Modal, Platform, Pressable, SafeAreaView, Text, View } from "react-native";
import { ApiError, enqueueMutation, fetchHousehold, fetchMobileSnapshot, getCachedUser, getPendingMutations, getSession, getToken, logout, syncPendingMutations, type PendingMutation } from "./api";
import { parseStatementText } from "./parsing";
import { applyPendingMutations, buildAlerts, createLocalId, hydrateModules, initialModules, modulePayload, moduleResource, snapshotAccounts, snapshotExpenses, snapshotGoals } from "./app-data";
import { AnimatedScreen, BottomNav, TopBar } from "./components/navigation";
import { AlertCenter, SkeletonScreen } from "./components/feedback";
import { Accounts, AuthScreen, Dashboard, Expenses, Goals, ModuleScreen, More } from "./components/screens";
import { isModuleScreen } from "./components/screen-helpers";
import { DataTransferForm, EmiSchedule, ExpenseForm, GoalForm, ReceiptScanner, VoiceExpenseForm } from "./components/forms";
import { initialExpenses, initialGoals, moduleLabels, money } from "./components/constants";
import { styles } from "./components/styles";
import type { AccountOption, Expense, Goal, ModuleItem, ModuleKey, Screen } from "./components/types";

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
