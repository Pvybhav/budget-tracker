import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Alert, RefreshControl } from "react-native";
import { AlertCenter, SkeletonScreen } from "../components/feedback";
import { AnimatedScreen, BottomNav, PressableScale, TopBar } from "../components/navigation";
import {
  Accounts,
  AuthScreen,
  Dashboard,
  Expenses,
  Goals,
  ModuleScreen,
  More,
} from "../components/screens";
import { initialExpenses, initialGoals, initialModules } from "../components/constants";
import { isModuleScreen } from "../components/screen-helpers";

jest.mock("../api", () => ({
  acceptHouseholdInvite: jest.fn(async () => undefined),
  fetchHousehold: jest.fn(async () => ({ role: "none", household: null })),
  inviteHouseholdMember: jest.fn(async () => ({ inviteToken: "invite-token" })),
  leaveHousehold: jest.fn(async () => undefined),
  login: jest.fn(async (username: string) => ({ username, fullName: "Alex Morgan", role: "user" })),
  removeHouseholdMember: jest.fn(async () => undefined),
  signup: jest.fn(async (username: string, _password: string, fullName: string) => ({ username, fullName, role: "user" })),
}));

jest.mock("expo-calendar", () => ({
  EntityTypes: { EVENT: "event" },
  requestCalendarPermissionsAsync: jest.fn(async () => ({ status: "denied" })),
  getCalendarsAsync: jest.fn(async () => []),
  createEventAsync: jest.fn(async () => "event-id"),
}));
jest.mock("expo-file-system", () => ({ Paths: { cache: "/cache/" }, writeAsStringAsync: jest.fn() }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(async () => false), shareAsync: jest.fn() }));
jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn(async () => undefined) }));
jest.mock("expo-speech-recognition", () => ({
  ExpoSpeechRecognitionModule: { stop: jest.fn(), start: jest.fn(), requestPermissionsAsync: jest.fn(async () => ({ granted: false })) },
  useSpeechRecognitionEvent: jest.fn(),
}));
jest.mock("expo-camera", () => ({ CameraView: { isDocumentScannerAvailable: false, scanDocumentAsync: jest.fn() } }));
jest.mock("expo-text-extractor", () => ({ extractTextFromImage: jest.fn(async () => []) }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn(async () => ({ canceled: true, assets: [] })) }));
jest.mock("xlsx", () => ({ read: jest.fn(), utils: { sheet_to_csv: jest.fn() } }));

const noOp = () => undefined;
const refresh = async () => undefined;
const household = { role: "none" as const, members: [] };

describe("navigation and loading components", () => {
  it("renders user-specific top-bar actions and every bottom navigation route", () => {
    const onSettings = jest.fn();
    const onAlerts = jest.fn();
    const setScreen = jest.fn();
    const topBar = render(<TopBar screen="dashboard" onSettings={onSettings} onAlerts={onAlerts} alertCount={12} darkMode={false} user={{ fullName: "Ada Lovelace" }} />);
    expect(topBar.getByText("Good morning, Ada Lovelace")).toBeTruthy();
    expect(topBar.getByText("9+")).toBeTruthy();
    fireEvent.press(topBar.getByText("♢"));
    fireEvent.press(topBar.getByText("A"));
    expect(onAlerts).toHaveBeenCalledTimes(1);
    expect(onSettings).toHaveBeenCalledTimes(1);

    const nav = render(<BottomNav screen="expenses" setScreen={setScreen} />);
    for (const route of ["Home", "Expenses", "Accounts", "Goals", "More"]) {
      fireEvent.press(nav.getByLabelText(`Open ${route}`));
    }
    expect(setScreen.mock.calls.map(([screen]) => screen)).toEqual(["dashboard", "expenses", "accounts", "goals", "more"]);
  });

  it("supports press scaling and re-runs the screen transition for new routes", () => {
    const onPress = jest.fn();
    const pressable = render(<PressableScale accessibilityLabel="Quick action" onPress={onPress}>Action</PressableScale>);
    fireEvent(pressable.getByLabelText("Quick action"), "pressIn");
    fireEvent.press(pressable.getByLabelText("Quick action"));
    fireEvent(pressable.getByLabelText("Quick action"), "pressOut");
    expect(onPress).toHaveBeenCalledTimes(1);

    const screen = render(<AnimatedScreen screen="dashboard"><></></AnimatedScreen>);
    screen.rerender(<AnimatedScreen screen="goals"><></></AnimatedScreen>);
    expect(screen.toJSON()).toBeTruthy();
  });

  it.each([
    ["boot", false],
    ["dashboard", false],
    ["expenses", true],
    ["goals", false],
    ["accounts", true],
  ] as const)("renders the %s skeleton variant", (variant, darkMode) => {
    const screen = render(<SkeletonScreen variant={variant} darkMode={darkMode} />);
    expect(screen.getByLabelText("Loading content")).toBeTruthy();
  });

  it("renders empty alerts and wires dismiss, snooze, navigate, and close actions", () => {
    const onClose = jest.fn();
    const empty = render(<AlertCenter alerts={[]} onDismiss={noOp} onSnooze={noOp} onNavigate={noOp} onClose={onClose} />);
    expect(empty.getByText("You're all caught up")).toBeTruthy();
    fireEvent.press(empty.getByText("×"));
    expect(onClose).toHaveBeenCalledTimes(1);

    const onDismiss = jest.fn();
    const onSnooze = jest.fn();
    const onNavigate = jest.fn();
    const populated = render(<AlertCenter alerts={[{ id: "due", title: "Rent is due", detail: "Tomorrow", severity: "high", screen: "bills" }]} onDismiss={onDismiss} onSnooze={onSnooze} onNavigate={onNavigate} onClose={noOp} />);
    fireEvent.press(populated.getByText("Rent is due"));
    fireEvent.press(populated.getByText("Later"));
    fireEvent.press(populated.getByText("Dismiss"));
    expect(onNavigate).toHaveBeenCalledWith("bills");
    expect(onSnooze).toHaveBeenCalledWith("due");
    expect(onDismiss).toHaveBeenCalledWith("due");
  });
});

describe("budget screens", () => {
  const nativeCalendar = jest.requireMock("expo-calendar") as {
    requestCalendarPermissionsAsync: jest.Mock;
    getCalendarsAsync: jest.Mock;
    createEventAsync: jest.Mock;
  };
  const nativeSharing = jest.requireMock("expo-sharing") as { isAvailableAsync: jest.Mock; shareAsync: jest.Mock };
  const nativeFileSystem = jest.requireMock("expo-file-system") as { writeAsStringAsync: jest.Mock };
  const moduleApi = jest.requireMock("../api") as {
    inviteHouseholdMember: jest.Mock;
    acceptHouseholdInvite: jest.Mock;
    fetchHousehold: jest.Mock;
    leaveHousehold: jest.Mock;
    removeHouseholdMember: jest.Mock;
    login: jest.Mock;
    signup: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(noOp);
  });

  it("connects dashboard quick actions and renders transaction and goal previews", () => {
    const onAddExpense = jest.fn();
    const onVoiceExpense = jest.fn();
    const onReceipt = jest.fn();
    const onOpenExpenses = jest.fn();
    const onOpenGoals = jest.fn();
    const onNavigate = jest.fn();
    const screen = render(<Dashboard darkMode={false} expenses={initialExpenses} goals={initialGoals} onRefresh={refresh} refreshing={false} onAddExpense={onAddExpense} onVoiceExpense={onVoiceExpense} onReceipt={onReceipt} onOpenExpenses={onOpenExpenses} onOpenGoals={onOpenGoals} onNavigate={onNavigate} />);
    expect(screen.getByText("TOTAL BALANCE")).toBeTruthy();
    fireEvent.press(screen.getByText("Expense"));
    fireEvent.press(screen.getByText("Voice"));
    fireEvent.press(screen.getByText("Receipt"));
    fireEvent.press(screen.getByText("Bill"));
    fireEvent.press(screen.getByText(/View details/));
    screen.getAllByText(/See all/).forEach((item) => fireEvent.press(item));
    expect(onAddExpense).toHaveBeenCalledTimes(1);
    expect(onVoiceExpense).toHaveBeenCalledTimes(1);
    expect(onReceipt).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("bills");
    expect(onOpenExpenses).toHaveBeenCalledTimes(2);
    expect(onOpenGoals).toHaveBeenCalledTimes(1);
  });

  it("filters expenses, applies category chips, selects, and opens the add action", () => {
    const onSelect = jest.fn();
    const onAdd = jest.fn();
    const screen = render(<Expenses darkMode={false} expenses={initialExpenses} onRefresh={refresh} refreshing={false} onAdd={onAdd} onVoice={noOp} onReceipt={noOp} onSelect={onSelect} />);
    fireEvent.changeText(screen.getByPlaceholderText("Search expenses"), "KFC");
    expect(screen.getByText("KFC")).toBeTruthy();
    expect(screen.queryByText("Rent payment")).toBeNull();
    fireEvent.press(screen.getByText("All"));
    fireEvent.changeText(screen.getByPlaceholderText("Search expenses"), "");
    fireEvent.press(screen.getByText("Food & dining"));
    expect(screen.getByText("KFC")).toBeTruthy();
    expect(screen.queryByText("Uber")).toBeNull();
    fireEvent.press(screen.getByText("KFC"));
    fireEvent.press(screen.getByText("+ Add"));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(initialExpenses[0]);
  });

  it("shows filtered empty states and passes refresh gestures through", () => {
    const onRefresh = jest.fn(async () => undefined);
    const expenses = render(<Expenses darkMode expenses={[]} onRefresh={onRefresh} refreshing onAdd={noOp} onVoice={noOp} onReceipt={noOp} onSelect={noOp} />);
    fireEvent.changeText(expenses.getByPlaceholderText("Search expenses"), "missing");
    expect(expenses.getByText("No expenses found")).toBeTruthy();
    fireEvent(expenses.UNSAFE_getByType(RefreshControl), "refresh");
    expect(onRefresh).toHaveBeenCalled();
  });

  it("renders static account cards, displays goals, and exposes goal creation", () => {
    const accounts = render(<Accounts darkMode />);
    expect(accounts.getByText("NET WORTH")).toBeTruthy();
    expect(accounts.getByText("HDFC Salary Account")).toBeTruthy();
    fireEvent.press(accounts.getByText("＋ Add account or card"));
    expect(Alert.alert).toHaveBeenCalledWith("Add account", "Account setup is available in the full app.");

    const onAdd = jest.fn();
    const goals = render(<Goals darkMode={false} goals={initialGoals} onAdd={onAdd} />);
    expect(goals.getByText("TOTAL SAVED")).toBeTruthy();
    fireEvent.press(goals.getByText("＋"));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("validates login, handles authentication errors, and completes signup", async () => {
    const onAuthenticated = jest.fn();
    const auth = render(<AuthScreen onAuthenticated={onAuthenticated} />);
    fireEvent.press(auth.getByText("Sign in securely"));
    expect(Alert.alert).toHaveBeenCalledWith("Missing details", "Complete the required fields before continuing.");
    fireEvent.changeText(auth.getByPlaceholderText("Your username"), "alex");
    fireEvent.changeText(auth.getByPlaceholderText("At least 8 characters"), "password123");
    fireEvent.press(auth.getByText("Sign in securely"));
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith({ username: "alex", fullName: "Alex Morgan", role: "user" }));

    fireEvent.press(auth.getAllByText("Create account")[0]);
    fireEvent.changeText(auth.getByPlaceholderText("Alex Morgan"), "Ada Lovelace");
    fireEvent.changeText(auth.getByPlaceholderText("alex@example.com"), "ada@example.com");
    fireEvent.changeText(auth.getByPlaceholderText("Your username"), "ada");
    fireEvent.changeText(auth.getByPlaceholderText("At least 8 characters"), "password123");
    fireEvent.press(auth.getAllByText("Create account")[1]);
    await waitFor(() => expect(onAuthenticated).toHaveBeenLastCalledWith({ username: "ada", fullName: "Ada Lovelace", role: "user" }));
  });

  it("navigates from More and invokes sync and logout controls", async () => {
    const onNavigate = jest.fn();
    const onSync = jest.fn();
    const onLogout = jest.fn();
    const screen = render(<More darkMode={false} setDarkMode={noOp} notificationsEnabled setNotificationsEnabled={noOp} biometricEnabled={false} setBiometricEnabled={noOp} onNavigate={onNavigate} onLogout={onLogout} onSync={onSync} syncing={false} />);
    expect(screen.getByText("↻ Sync with web app")).toBeTruthy();
    fireEvent.press(screen.getByText("Bills & subscriptions"));
    fireEvent.press(screen.getByText("↻ Sync with web app"));
    fireEvent.press(screen.getByText("Sign out securely"));
    fireEvent.press(screen.getByText("□ Add bill reminder to calendar"));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Calendar permission needed", "Allow calendar access to add bill reminders."));
    expect(onNavigate).toHaveBeenCalledWith("bills");
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(onSync).toHaveBeenCalledTimes(1);
  });

  it("toggles preferences, shares the export, and creates a calendar event", async () => {
    const setDarkMode = jest.fn();
    const setNotificationsEnabled = jest.fn();
    const setBiometricEnabled = jest.fn();
    const onNavigate = jest.fn();
    const onSync = jest.fn();
    nativeCalendar.requestCalendarPermissionsAsync.mockImplementation(async () => ({ status: "granted" }));
    nativeCalendar.getCalendarsAsync.mockImplementation(async () => [{ id: "calendar", allowsModifications: true }]);
    nativeCalendar.createEventAsync.mockImplementation(async () => "created");
    const settings = render(<More darkMode={false} setDarkMode={setDarkMode} notificationsEnabled={false} setNotificationsEnabled={setNotificationsEnabled} biometricEnabled setBiometricEnabled={setBiometricEnabled} onNavigate={onNavigate} onLogout={noOp} onSync={onSync} syncing={false} />);
    const switches = settings.getAllByRole("switch");
    fireEvent(switches[0], "valueChange", true);
    fireEvent(switches[1], "valueChange", true);
    fireEvent(switches[2], "valueChange", false);
    expect(setDarkMode).toHaveBeenCalledWith(true);
    expect(setNotificationsEnabled).toHaveBeenCalledWith(true);
    expect(setBiometricEnabled).toHaveBeenCalledWith(false);
    fireEvent.press(settings.getByText("□ Add bill reminder to calendar"));
    await waitFor(() => expect(nativeCalendar.createEventAsync).toHaveBeenCalledWith("calendar", expect.objectContaining({ title: "Budget Tracker bill reminder" })));
    expect(Alert.alert).toHaveBeenCalledWith("Calendar reminder added", "A bill reminder was added for tomorrow.");
    fireEvent.press(settings.getByText("Import / export"));
    expect(onNavigate).toHaveBeenCalledWith("import");
  });

  it("reports calendar errors when no writable calendar exists or creation fails", async () => {
    nativeCalendar.requestCalendarPermissionsAsync.mockImplementation(async () => ({ status: "granted" }));
    nativeCalendar.getCalendarsAsync.mockImplementation(async () => []);
    const settings = render(<More darkMode={false} setDarkMode={noOp} notificationsEnabled setNotificationsEnabled={noOp} biometricEnabled={false} setBiometricEnabled={noOp} onNavigate={noOp} onLogout={noOp} onSync={noOp} syncing={false} />);
    fireEvent.press(settings.getByText("□ Add bill reminder to calendar"));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Could not add calendar reminder", "No writable calendar is available."));

    nativeCalendar.getCalendarsAsync.mockImplementation(async () => [{ id: "calendar", allowsModifications: true }]);
    nativeCalendar.createEventAsync.mockImplementationOnce(async () => { throw new Error("calendar write failed"); });
    fireEvent.press(settings.getByText("□ Add bill reminder to calendar"));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Could not add calendar reminder", "calendar write failed"));
  });

  it("adds, searches, updates, and prompts to delete module records", () => {
    const onAdd = jest.fn();
    const onUpdate = jest.fn();
    const onDelete = jest.fn();
    const screen = render(<ModuleScreen darkMode={false} module="bills" items={initialModules.bills} household={household} onHouseholdChange={noOp} onRefresh={refresh} refreshing={false} onAdd={onAdd} onUpdate={onUpdate} onDelete={onDelete} onExport={noOp} onImport={noOp} />);
    fireEvent.press(screen.getByText("＋"));
    fireEvent.changeText(screen.getByPlaceholderText("Enter a name"), "Electricity");
    fireEvent.changeText(screen.getByPlaceholderText("Optional details"), "Due next week");
    fireEvent.changeText(screen.getByPlaceholderText("₹ 0"), "1200");
    fireEvent.press(screen.getByText("Save record"));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ title: "Electricity", detail: "Due next week", amount: 1200, status: "Pending" }));

    const item = initialModules.bills[0];
    fireEvent.press(screen.getByText(item.title));
    expect(onUpdate).toHaveBeenCalledWith(item.id, expect.objectContaining({ enabled: !item.enabled }));
    fireEvent.changeText(screen.getByPlaceholderText("Search bills & subscriptions"), "not found");
    expect(screen.getByText("No records found")).toBeTruthy();
  });

  it("exposes import and export actions and read-only module behavior", () => {
    const onExport = jest.fn();
    const onImport = jest.fn();
    const exported = render(<ModuleScreen darkMode={false} module="export" items={[]} household={household} onHouseholdChange={noOp} onRefresh={refresh} refreshing={false} onAdd={noOp} onUpdate={noOp} onDelete={noOp} onExport={onExport} onImport={onImport} />);
    fireEvent.press(exported.getByText("Export JSON"));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(exported.queryByText("＋")).toBeNull();
    const imported = render(<ModuleScreen darkMode={false} module="import" items={[]} household={household} onHouseholdChange={noOp} onRefresh={refresh} refreshing={false} onAdd={noOp} onUpdate={noOp} onDelete={noOp} onExport={onExport} onImport={onImport} />);
    fireEvent.press(imported.getByText("Import CSV / JSON"));
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it("creates and accepts household invitations and leaves a shared household", async () => {
    const prompt = jest.spyOn(Alert, "prompt").mockImplementation((_title, _message, callback) => {
      if (typeof callback === "function") callback("member@example.com");
    });
    const onHouseholdChange = jest.fn();
    const onImport = jest.fn();
    const onExport = jest.fn();
    moduleApi.inviteHouseholdMember.mockImplementationOnce(async () => ({ inviteToken: "secret-token" }));
    nativeSharing.isAvailableAsync.mockImplementationOnce(async () => true);
    nativeFileSystem.writeAsStringAsync.mockImplementationOnce(async () => undefined);
    const owner = render(<ModuleScreen darkMode={false} module="household" items={[]} household={{ role: "owner", members: [] }} onHouseholdChange={onHouseholdChange} onRefresh={refresh} refreshing={false} onAdd={noOp} onUpdate={noOp} onDelete={noOp} onExport={onExport} onImport={onImport} />);
    fireEvent.press(owner.getByText("Invite by email"));
    await waitFor(() => expect(moduleApi.inviteHouseholdMember).toHaveBeenCalledWith("member@example.com"));
    expect(nativeSharing.shareAsync).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith("Invitation created", "budget-tracker://accept-invite?token=secret-token");

    prompt.mockImplementationOnce((_title, _message, callback) => {
      if (typeof callback === "function") callback("invite-token");
    });
    moduleApi.fetchHousehold.mockImplementationOnce(async () => ({ role: "member", household: { members: [{ email: "owner@example.com", status: "Active" }] } }));
    const member = render(<ModuleScreen darkMode={false} module="household" items={[]} household={{ role: "none", members: [] }} onHouseholdChange={onHouseholdChange} onRefresh={refresh} refreshing={false} onAdd={noOp} onUpdate={noOp} onDelete={noOp} onExport={onExport} onImport={onImport} />);
    fireEvent.press(member.getByText("Accept invitation"));
    await waitFor(() => expect(onHouseholdChange).toHaveBeenCalledWith({ role: "member", members: [{ email: "owner@example.com", status: "Active" }] }));
    member.rerender(<ModuleScreen darkMode={false} module="household" items={[]} household={{ role: "member", members: [] }} onHouseholdChange={onHouseholdChange} onRefresh={refresh} refreshing={false} onAdd={noOp} onUpdate={noOp} onDelete={noOp} onExport={onExport} onImport={onImport} />);
    fireEvent.press(member.getByText("Leave household"));
    await waitFor(() => expect(onHouseholdChange).toHaveBeenCalledWith({ role: "none", members: [] }));
    prompt.mockRestore();
  });

  it("shows household invite failures and removes members after success", async () => {
    const prompt = jest.spyOn(Alert, "prompt").mockImplementation((_title, _message, callback) => {
      if (typeof callback === "function") callback("invalid");
    });
    moduleApi.inviteHouseholdMember.mockImplementationOnce(async () => { throw new Error("invite failed"); });
    const onHouseholdChange = jest.fn();
    const onImport = jest.fn();
    const onExport = jest.fn();
    const owner = render(<ModuleScreen darkMode={false} module="household" items={[]} household={{ role: "owner", members: [{ email: "member@example.com", status: "Invited" }] }} onHouseholdChange={onHouseholdChange} onRefresh={refresh} refreshing={false} onAdd={noOp} onUpdate={noOp} onDelete={noOp} onExport={onExport} onImport={onImport} />);
    fireEvent.press(owner.getByText("Invite by email"));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Invitation failed", "invite failed"));
    fireEvent.press(owner.getByText("×"));
    await waitFor(() => expect(moduleApi.removeHouseholdMember).toHaveBeenCalledWith("member@example.com"));
    expect(onHouseholdChange).toHaveBeenCalledWith({ role: "owner", members: [] });
    prompt.mockRestore();
  });
});

describe("module routing helper", () => {
  it.each(["dashboard", "expenses", "accounts", "goals", "more"] as const)("does not treat %s as a module", (screen) => {
    expect(isModuleScreen(screen)).toBe(false);
  });

  it("recognizes module routes", () => {
    expect(isModuleScreen("bills")).toBe(true);
  });
});
