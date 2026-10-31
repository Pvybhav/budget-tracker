import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import App from "../App";
import { enqueueMutation, login } from "../api";

jest.mock("../api", () => ({
  ApiError: class ApiError extends Error {},
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
  logout: jest.fn(),
  removeHouseholdMember: jest.fn(),
  signup: jest.fn(),
  syncPendingMutations: jest.fn(async () => ({ synced: 0, remaining: 0 })),
}));

jest.mock("../widget", () => ({ updateBudgetTrackerWidget: jest.fn() }));
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
jest.mock("expo-share-intent", () => ({
  useShareIntent: () => ({ hasShareIntent: false, shareIntent: {}, resetShareIntent: jest.fn(), error: null }),
}));

describe("mobile app", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
