import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, AppState } from "react-native";
import App from "../App";
import {
  ApiError,
  enqueueMutation,
  fetchHousehold,
  fetchMobileSnapshot,
  getCachedUser,
  getPendingMutations,
  getSession,
  getToken,
  login,
  logout,
  syncPendingMutations,
} from "../api";

jest.mock("../api", () => ({
  ApiError: class ApiError extends Error {
    status: number;

    constructor(message: string, mockStatus: number) {
      super(message);
      this.status = mockStatus;
    }
  },
  acceptHouseholdInvite: jest.fn(),
  enqueueMutation: jest.fn(async () => []),
  fetchHousehold: jest.fn(async () => ({ role: "none", household: null })),
  fetchMobileSnapshot: jest.fn(async () => ({})),
  getCachedUser: jest.fn(async () => null),
  getPendingMutations: jest.fn(async () => []),
  getSession: jest.fn(),
  getToken: jest.fn(async () => null),
  inviteHouseholdMember: jest.fn(),
  leaveHousehold: jest.fn(),
  login: jest.fn(async () => ({ username: "alex", fullName: "Alex Morgan", role: "user" })),
  logout: jest.fn(async () => undefined),
  removeHouseholdMember: jest.fn(),
  signup: jest.fn(),
  syncPendingMutations: jest.fn(async () => ({ synced: 0, remaining: 0 })),
}));

jest.mock("../widget-service", () => ({ updateBudgetTrackerWidget: jest.fn() }));
jest.mock("expo-speech-recognition", () => ({
  ExpoSpeechRecognitionModule: {
    stop: jest.fn(),
    start: jest.fn(),
    requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
  },
  useSpeechRecognitionEvent: jest.fn(),
}));
jest.mock("expo-camera", () => ({
  CameraView: { isDocumentScannerAvailable: false, scanDocumentAsync: jest.fn() },
}));
jest.mock("expo-text-extractor", () => ({ extractTextFromImage: jest.fn(async () => []) }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  setNotificationCategoryAsync: jest.fn(async () => undefined),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getPermissionsAsync: jest.fn(async () => ({ granted: false })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
  scheduleNotificationAsync: jest.fn(async () => "notification-id"),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: "timeInterval" },
}));
jest.mock("expo-task-manager", () => ({ defineTask: jest.fn() }));
jest.mock("expo-background-task", () => ({
  BackgroundTaskResult: { Success: "success", Failed: "failed" },
  registerTaskAsync: jest.fn(async () => undefined),
  unregisterTaskAsync: jest.fn(async () => undefined),
}));
jest.mock("expo-network", () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: false, isInternetReachable: false })),
}));
jest.mock("expo-quick-actions", () => ({
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  isSupported: jest.fn(async () => false),
  setItems: jest.fn(async () => undefined),
  initial: null,
}));
jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(async () => false),
  isEnrolledAsync: jest.fn(async () => false),
  authenticateAsync: jest.fn(async () => ({ success: false })),
}));
jest.mock("expo-file-system/legacy", () => ({
  readAsStringAsync: jest.fn(async () => ""),
}));
jest.mock("expo-share-intent", () => ({
  useShareIntent: jest.fn(() => ({ hasShareIntent: false, shareIntent: {}, resetShareIntent: jest.fn(), error: null })),
}));

describe("mobile app", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    jest.mocked(getToken).mockResolvedValue(null);
    jest.mocked(getCachedUser).mockResolvedValue(null);
    jest.mocked(getPendingMutations).mockResolvedValue([]);
    jest.mocked(fetchMobileSnapshot).mockResolvedValue({});
    jest.mocked(fetchHousehold).mockResolvedValue({ role: "none", household: null });
    jest.mocked(syncPendingMutations).mockResolvedValue({ synced: 0, remaining: 0 });
  });

  it("boots to the sign-in form and displays sign-up fields when selected", async () => {
    const screen = render(<App />);

    await screen.findByText("Budget Tracker");
    expect(screen.getByPlaceholderText("Your username")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Alex Morgan")).toBeNull();

    fireEvent.press(screen.getByText("Create account"));
    expect(screen.getByPlaceholderText("Alex Morgan")).toBeTruthy();
    expect(screen.getByPlaceholderText("alex@example.com")).toBeTruthy();
  });

  it("authenticates, hydrates cached data, and navigates to expenses", async () => {
    const screen = render(<App />);
    await screen.findByText("Budget Tracker");
    fireEvent.changeText(screen.getByPlaceholderText("Your username"), "alex");
    fireEvent.changeText(screen.getByPlaceholderText("At least 8 characters"), "password123");
    fireEvent.press(screen.getByText("Sign in securely"));

    await waitFor(() => expect(login).toHaveBeenCalledWith("alex", "password123"));
    await screen.findByText("Good morning, Alex Morgan");
    expect(screen.getByText("KFC")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Open Expenses"));
    await screen.findByText("Your expenses");
    expect(screen.getByPlaceholderText("Search expenses")).toBeTruthy();
  });

  it("saves a new goal locally while offline", async () => {
    const screen = render(<App />);
    await screen.findByText("Budget Tracker");
    fireEvent.changeText(screen.getByPlaceholderText("Your username"), "alex");
    fireEvent.changeText(screen.getByPlaceholderText("At least 8 characters"), "password123");
    fireEvent.press(screen.getByText("Sign in securely"));
    await screen.findByText("Good morning, Alex Morgan");

    fireEvent.press(screen.getByLabelText("Open Goals"));
    await screen.findByText("TOTAL SAVED");
    fireEvent.press(screen.getByText("＋"));
    fireEvent.changeText(screen.getByPlaceholderText("e.g. New phone"), "Weekend trip");
    fireEvent.changeText(screen.getByPlaceholderText("₹ 0"), "25000");
    fireEvent.press(screen.getByText("Create goal"));

    await screen.findByText("Weekend trip");
    expect(enqueueMutation).toHaveBeenCalledWith(expect.objectContaining({
      resource: "savings-goals",
      operation: "create",
      collection: "goals",
      payload: expect.objectContaining({ title: "Weekend trip", targetAmount: 25000 }),
    }));
    expect(screen.getByText(/Offline mode/)).toBeTruthy();
  });

  it("restores an online session, hydrates server data, and exercises the primary app flows", async () => {
    const user = { username: "alex", fullName: "Alex Morgan", role: "user" };
    const network = jest.requireMock("expo-network") as {
      getNetworkStateAsync: jest.Mock;
      addNetworkStateListener: jest.Mock;
    };
    const notifications = jest.requireMock("expo-notifications") as {
      getPermissionsAsync: jest.Mock;
      requestPermissionsAsync: jest.Mock;
      scheduleNotificationAsync: jest.Mock;
      addNotificationResponseReceivedListener: jest.Mock;
    };
    const quickActions = jest.requireMock("expo-quick-actions") as {
      addListener: jest.Mock;
      isSupported: jest.Mock;
    };
    const backgroundTask = jest.requireMock("expo-background-task") as { registerTaskAsync: jest.Mock };
    const widget = jest.requireMock("../widget-service") as { updateBudgetTrackerWidget: jest.Mock };
    const shareIntent = jest.requireMock("expo-share-intent") as { useShareIntent: jest.Mock };
    const snapshot = {
      cards: [{ id: "card-1", title: "Checking" }],
      categories: [{ id: "0123456789abcdef01234567", title: "Food & dining" }],
      expenses: [{
        id: "expense-1",
        details: "Phone",
        categoryId: "Electronics",
        amount: 1200,
        date: new Date().toISOString(),
        isEmi: true,
        emiMonths: 12,
      }],
      "savings-goals": [{ id: "goal-1", title: "Trip", targetAmount: 1000, currentAmount: 250 }],
      bills: [{ id: "bill-1", name: "Electricity", note: "Tomorrow", status: "Due", amount: 500 }],
      payments: [{ id: "payment-1", title: "Card", note: "Today", status: "Pending", amount: 200 }],
      "budget-rules": [],
    };

    jest.mocked(getToken).mockResolvedValue("session-token");
    jest.mocked(getSession).mockResolvedValue({ user });
    jest.mocked(getCachedUser).mockResolvedValue(user);
    jest.mocked(getCachedUser).mockResolvedValue(user);
    jest.mocked(fetchMobileSnapshot).mockResolvedValue(snapshot);
    jest.mocked(fetchHousehold).mockResolvedValue({ role: "owner", household: { members: [] } });
    jest.mocked(getPendingMutations).mockResolvedValue([]);
    jest.mocked(syncPendingMutations).mockResolvedValue({ synced: 0, remaining: 0 });
    network.getNetworkStateAsync.mockImplementation(async () => ({ isConnected: true, isInternetReachable: true }));
    notifications.getPermissionsAsync.mockImplementation(async () => ({ granted: true }));
    notifications.requestPermissionsAsync.mockImplementation(async () => ({ granted: true }));
    quickActions.isSupported.mockImplementation(async () => true);
    shareIntent.useShareIntent.mockImplementation(() => ({ hasShareIntent: false, shareIntent: {}, resetShareIntent: jest.fn(), error: null }));
    await AsyncStorage.setItem("budget-tracker-mobile-notifications", "true");
    await AsyncStorage.setItem("budget-tracker-mobile-dark-mode", "true");

    const screen = render(<App />);
    await screen.findByText("Good morning, Alex Morgan");
    expect(screen.getByText("Phone")).toBeTruthy();
    expect(screen.getByText("Trip")).toBeTruthy();
    await waitFor(() => expect(fetchMobileSnapshot).toHaveBeenCalled());
    await waitFor(() => expect(notifications.scheduleNotificationAsync).toHaveBeenCalled());
    expect(backgroundTask.registerTaskAsync).toHaveBeenCalledWith("budget-tracker-background-sync", { minimumInterval: 30 });
    expect(widget.updateBudgetTrackerWidget).toHaveBeenLastCalledWith(expect.objectContaining({ balance: "₹1,84,250" }));

    fireEvent.press(screen.getByText("♢"));
    expect(screen.getByText("Alerts")).toBeTruthy();
    expect(screen.getByText("Electricity is due")).toBeTruthy();
    fireEvent.press(screen.getAllByText("Later")[0]);
    fireEvent.press(screen.getByText("×"));

    fireEvent.press(screen.getByText("Expense"));
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Coffee, rent, groceries"), "Lunch");
    fireEvent.changeText(screen.getByPlaceholderText("₹ 0"), "450");
    fireEvent.press(screen.getByText("Save expense"));
    await waitFor(() => expect(enqueueMutation).toHaveBeenCalledWith(expect.objectContaining({
      resource: "expenses",
      payload: expect.objectContaining({ cardId: "card-1", categoryId: "0123456789abcdef01234567" }),
    })));

    fireEvent.press(screen.getByLabelText("Open Goals"));
    await screen.findByText("TOTAL SAVED");
    fireEvent.press(screen.getByText("＋"));
    fireEvent.changeText(screen.getByPlaceholderText("e.g. New phone"), "Camera");
    fireEvent.changeText(screen.getByPlaceholderText("₹ 0"), "2000");
    fireEvent.press(screen.getByText("Create goal"));
    await waitFor(() => expect(enqueueMutation).toHaveBeenCalledWith(expect.objectContaining({ resource: "savings-goals" })));

    fireEvent.press(screen.getByLabelText("Open More"));
    const switches = screen.getAllByRole("switch");
    fireEvent(switches[0], "valueChange", false);
    fireEvent(switches[1], "valueChange", false);
    await expect(AsyncStorage.getItem("budget-tracker-mobile-dark-mode")).resolves.toBe("false");
    await expect(AsyncStorage.getItem("budget-tracker-mobile-notifications")).resolves.toBe("false");

    fireEvent.press(screen.getAllByText("Bills & subscriptions")[0]);
    await screen.findByPlaceholderText("Search bills & subscriptions");
    fireEvent.press(screen.getByText("Electricity"));
    expect(enqueueMutation).toHaveBeenCalled();

    expect(network.addNetworkStateListener).toHaveBeenCalled();
    expect(quickActions.addListener).toHaveBeenCalled();
    expect(notifications.addNotificationResponseReceivedListener).toHaveBeenCalled();
  });

  it("restores a cached session offline and applies newer background snapshots and queued changes", async () => {
    const user = { username: "alex", fullName: "Alex Morgan", role: "user" };
    const network = jest.requireMock("expo-network") as { getNetworkStateAsync: jest.Mock };
    const cachedExpense = { id: "cache-expense", title: "Cached coffee", category: "Food", amount: 25, date: "Today" };
    jest.mocked(getToken).mockResolvedValue("session-token");
    jest.mocked(getCachedUser).mockResolvedValue(user);
    network.getNetworkStateAsync.mockImplementation(async () => ({ isConnected: false, isInternetReachable: false }));
    jest.mocked(getPendingMutations).mockResolvedValue([{
      id: "queued-expense",
      username: user.username,
      resource: "expenses",
      operation: "create",
      recordId: "local-expense",
      collection: "expenses",
      optimisticRecord: { ...cachedExpense, id: "local-expense", title: "Queued coffee" },
      createdAt: 1,
    }]);
    await AsyncStorage.setItem("budget-tracker-mobile-notifications", "false");
    await AsyncStorage.setItem("budget-tracker-mobile-cache", JSON.stringify({
      username: user.username,
      updatedAt: 1,
      expenses: [cachedExpense],
      goals: [],
      accounts: [{ id: "cached-card", title: "Cached account" }],
    }));
    await AsyncStorage.setItem("budget-tracker-mobile-background-cache", JSON.stringify({
      username: user.username,
      syncedAt: 2,
      snapshot: {
        expenses: [{ id: "background-expense", details: "Background sync", amount: 60, date: "Today" }],
        "savings-goals": [],
        cards: [{ id: "background-card", title: "Background account" }],
        bills: [],
      },
    }));

    const screen = render(<App />);
    await screen.findByText("Good morning, Alex Morgan");
    expect(screen.getByText("Background sync")).toBeTruthy();
    expect(screen.getByText("Queued coffee")).toBeTruthy();
    expect(screen.getByText(/1 saved change waiting to sync/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Open Expenses"));
    await screen.findByText("Your expenses");
    expect(screen.getByText("Background sync")).toBeTruthy();
  });

  it("clears unauthorized sessions and falls back to cached users on transient session errors", async () => {
    const user = { username: "alex", fullName: "Alex Morgan", role: "user" };
    const network = jest.requireMock("expo-network") as { getNetworkStateAsync: jest.Mock };
    jest.mocked(getToken).mockResolvedValue("expired-token");
    network.getNetworkStateAsync.mockImplementation(async () => ({ isConnected: true, isInternetReachable: true }));
    jest.mocked(getSession).mockRejectedValueOnce(new ApiError("Expired", 401));
    const loggedOut = render(<App />);
    await loggedOut.findByText("Budget Tracker");
    await waitFor(() => expect(logout).toHaveBeenCalled());
    loggedOut.unmount();

    jest.clearAllMocks();
    jest.mocked(getToken).mockResolvedValue("offline-token");
    jest.mocked(getCachedUser).mockResolvedValue(user);
    jest.mocked(getSession).mockRejectedValueOnce(new Error("server unavailable"));
    jest.mocked(syncPendingMutations).mockRejectedValueOnce(new Error("sync unavailable"));
    network.getNetworkStateAsync.mockImplementation(async () => ({ isConnected: true, isInternetReachable: true }));
    await AsyncStorage.setItem("budget-tracker-mobile-notifications", "false");
    const recovered = render(<App />);
    await recovered.findByText("Good morning, Alex Morgan");
    await waitFor(() => expect(recovered.getByText("Sync issue: sync unavailable")).toBeTruthy());
  });

  it("imports shared text into the data form and reports malformed shared files", async () => {
    const share = jest.requireMock("expo-share-intent") as { useShareIntent: jest.Mock };
    const fileSystem = jest.requireMock("expo-file-system/legacy") as { readAsStringAsync: jest.Mock };
    const user = { username: "alex", fullName: "Alex Morgan", role: "user" };
    const network = jest.requireMock("expo-network") as { getNetworkStateAsync: jest.Mock };
    jest.mocked(getToken).mockResolvedValue("session-token");
    jest.mocked(getSession).mockResolvedValue({ user });
    jest.mocked(getCachedUser).mockResolvedValue(user);
    jest.mocked(fetchMobileSnapshot).mockResolvedValue({ cards: [], expenses: [], "savings-goals": [] });
    network.getNetworkStateAsync.mockImplementation(async () => ({ isConnected: false, isInternetReachable: false }));
    await AsyncStorage.setItem("budget-tracker-mobile-notifications", "false");
    const resetShareIntent = jest.fn();
    share.useShareIntent.mockImplementation(() => ({
      hasShareIntent: true,
      shareIntent: { text: "date,description,amount\n2025-01-02,Coffee,-25" },
      resetShareIntent,
      error: null,
    }));
    const screen = render(<App />);
    await screen.findByText("Import bank statement");
    expect(screen.getByDisplayValue("date,description,amount\n2025-01-02,Coffee,-25")).toBeTruthy();
    expect(resetShareIntent).toHaveBeenCalled();
    fireEvent.press(screen.getByText("Cancel"));

    share.useShareIntent.mockImplementation(() => ({
      hasShareIntent: true,
      shareIntent: { files: [{ path: "/tmp/broken.csv", mimeType: "text/csv" }] },
      resetShareIntent: jest.fn(),
      error: null,
    }));
    fileSystem.readAsStringAsync.mockImplementationOnce(async () => { throw new Error("file read failed"); });
    render(<App />);
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Could not open shared content", "file read failed"));
  });

  it("handles notification actions, app quick actions, and app-state transitions", async () => {
    const user = { username: "alex", fullName: "Alex Morgan", role: "user" };
    const network = jest.requireMock("expo-network") as { getNetworkStateAsync: jest.Mock };
    const notifications = jest.requireMock("expo-notifications") as { addNotificationResponseReceivedListener: jest.Mock };
    const quickActions = jest.requireMock("expo-quick-actions") as { addListener: jest.Mock; isSupported: jest.Mock; setItems: jest.Mock };
    let responseListener: ((response: { actionIdentifier: string; notification: { request: { content: { data: Record<string, unknown> } } } }) => void) | undefined;
    let quickActionListener: ((action: { id: string }) => void) | undefined;
    notifications.addNotificationResponseReceivedListener.mockImplementation((listener: unknown) => {
      responseListener = listener as typeof responseListener;
      return { remove: jest.fn() };
    });
    quickActions.addListener.mockImplementation((listener: unknown) => {
      quickActionListener = listener as typeof quickActionListener;
      return { remove: jest.fn() };
    });
    quickActions.isSupported.mockImplementation(async () => true);
    jest.mocked(getToken).mockResolvedValue("session-token");
    jest.mocked(getCachedUser).mockResolvedValue(user);
    jest.mocked(getSession).mockResolvedValue({ user });
    jest.mocked(fetchMobileSnapshot).mockResolvedValue({
      bills: [{ id: "bill-1", name: "Electricity", note: "Tomorrow", status: "Due", amount: 500 }],
    });
    network.getNetworkStateAsync.mockImplementation(async () => ({ isConnected: false, isInternetReachable: false }));
    await AsyncStorage.setItem("budget-tracker-mobile-notifications", "false");

    const appStateSpy = jest.spyOn(AppState, "addEventListener");
    const screen = render(<App />);
    await screen.findByText("Good morning, Alex Morgan");
    await waitFor(() => expect(quickActions.setItems).toHaveBeenCalled());
    for (const [eventName, listener] of appStateSpy.mock.calls) {
      if (eventName === "change") act(() => listener("active"));
    }

    act(() => quickActionListener?.({ id: "add-expense" }));
    expect(screen.getByText("Add expense")).toBeTruthy();
    fireEvent.press(screen.getByText("×"));
    act(() => quickActionListener?.({ id: "scan-receipt" }));
    expect(screen.getByText("Scan receipt")).toBeTruthy();
    fireEvent.press(screen.getByText("×"));
    act(() => quickActionListener?.({ id: "view-alerts" }));
    expect(screen.getByText("Electricity is due")).toBeTruthy();
    fireEvent.press(screen.getByText("×"));

    act(() => responseListener?.({
      actionIdentifier: "SNOOZE",
      notification: { request: { content: { data: { alertId: "bill-bill-1" } } } },
    }));
    await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem("budget-tracker-mobile-snoozed-alerts")) ?? "{}")["bill-bill-1"]).toEqual(expect.any(Number)));
    act(() => responseListener?.({
      actionIdentifier: "DISMISS",
      notification: { request: { content: { data: { alertId: "bill-bill-1" } } } },
    }));
    await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem("budget-tracker-mobile-dismissed-alerts")) ?? "[]")).toContain("bill-bill-1"));

    act(() => responseListener?.({
      actionIdentifier: "OPEN",
      notification: { request: { content: { data: { alertId: "bill-bill-1", screen: "bills" } } } },
    }));
    await screen.findByPlaceholderText("Search bills & subscriptions");
    expect(appStateSpy).toHaveBeenCalled();
    appStateSpy.mockRestore();
  });
});
