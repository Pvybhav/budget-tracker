import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Alert } from "react-native";
import {
  DataTransferForm,
  EmiSchedule,
  ExpenseForm,
  Field,
  FormSheet,
  GoalForm,
  ModuleForm,
  ReceiptScanner,
  VoiceExpenseForm,
} from "../components/forms";

type AsyncMock = jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
const mockFor = <T,>(moduleName: string) => jest.requireMock(moduleName) as T;

const mockRecognitionHandlers: Record<string, (event: never) => void> = {};

jest.mock("expo-speech-recognition", () => ({
  ExpoSpeechRecognitionModule: {
    stop: jest.fn(),
    start: jest.fn(),
    requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
  },
  useSpeechRecognitionEvent: (event: string, callback: (value: never) => void) => {
    mockRecognitionHandlers[event] = callback;
  },
}));
jest.mock("expo-camera", () => ({ CameraView: { isDocumentScannerAvailable: false, scanDocumentAsync: jest.fn() } }));
jest.mock("expo-text-extractor", () => ({ extractTextFromImage: jest.fn(async () => ["Cafe Luna", "Total INR 450.00"]) }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn(async () => ({ canceled: true, assets: [] })) }));
jest.mock("expo-file-system", () => ({
  Paths: { cache: "/cache/" },
  EncodingType: { Base64: "base64" },
  writeAsStringAsync: jest.fn(async () => undefined),
  readAsStringAsync: jest.fn(async () => ""),
}));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => undefined) }));
jest.mock("xlsx", () => ({ read: jest.fn(), utils: { sheet_to_csv: jest.fn() } }));

describe("form primitives and expense forms", () => {
  beforeEach(() => {
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    jest.clearAllMocks();
  });

  it("renders and closes the shared form sheet and displays labeled fields", () => {
    const onClose = jest.fn();
    const sheet = render(<FormSheet title="Test sheet" onClose={onClose}><Field label="Description" value="Coffee" onChangeText={() => undefined} placeholder="Enter text" /></FormSheet>);
    expect(sheet.getByText("Test sheet")).toBeTruthy();
    expect(sheet.getByText("Description")).toBeTruthy();
    fireEvent.press(sheet.getByText("×"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("validates expense details and saves the selected account/category", () => {
    const onSave = jest.fn();
    const expense = render(<ExpenseForm accounts={[{ id: "checking", title: "Checking" }, { id: "card", title: "Card" }]} onClose={() => undefined} onSave={onSave} />);
    fireEvent.press(expense.getByText("Save expense"));
    expect(Alert.alert).toHaveBeenCalledWith("Add some details", "Enter a description and a valid amount.");
    fireEvent.changeText(expense.getByPlaceholderText("e.g. Coffee, rent, groceries"), "Train");
    fireEvent.changeText(expense.getByPlaceholderText("₹ 0"), "250");
    fireEvent.press(expense.getByText("Transport"));
    fireEvent.press(expense.getByText("Card"));
    fireEvent.press(expense.getByText("Save expense"));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "Train", amount: 250, category: "Transport", cardId: "card" }));
  });

  it("trims an expense description when the field loses focus", () => {
    const onSave = jest.fn();
    const expense = render(<ExpenseForm accounts={[{ id: "checking", title: "Checking" }]} onClose={() => undefined} onSave={onSave} />);
    const description = expense.getByPlaceholderText("e.g. Coffee, rent, groceries");
    fireEvent.changeText(description, "  Train fare  ");
    fireEvent(description, "blur");
    expect(expense.getByDisplayValue("Train fare")).toBeTruthy();
  });

  it("requires a synchronized account before recording an expense", () => {
    const noAccount = render(<ExpenseForm accounts={[]} onClose={() => undefined} onSave={() => undefined} />);
    fireEvent.changeText(noAccount.getByPlaceholderText("e.g. Coffee, rent, groceries"), "Tea");
    fireEvent.changeText(noAccount.getByPlaceholderText("₹ 0"), "10");
    fireEvent.press(noAccount.getByText("Save expense"));
    expect(Alert.alert).toHaveBeenCalledWith("Account required", "Add an account in the web app and sync before saving an expense.");
  });

  it("validates and saves a savings goal", () => {
    const onSave = jest.fn();
    const goal = render(<GoalForm onClose={() => undefined} onSave={onSave} />);
    fireEvent.press(goal.getByText("Create goal"));
    expect(Alert.alert).toHaveBeenCalledWith("Add some details", "Enter a goal name and target amount.");
    fireEvent.changeText(goal.getByPlaceholderText("e.g. New phone"), "Holiday");
    fireEvent.changeText(goal.getByPlaceholderText("₹ 0"), "30000");
    fireEvent.press(goal.getByText("Create goal"));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "Holiday", target: 30000, saved: 0 }));
  });

  it("validates a module record and supplies the module defaults", () => {
    const onSave = jest.fn();
    const form = render(<ModuleForm module="categories" onClose={() => undefined} onSave={onSave} />);
    fireEvent.press(form.getByText("Save record"));
    expect(Alert.alert).toHaveBeenCalledWith("Add a name", "Enter a name before saving.");
    fireEvent.changeText(form.getByPlaceholderText("Enter a name"), "Utilities");
    fireEvent.press(form.getByText("Save record"));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "Utilities", detail: "Added just now", status: "Active" }));
  });

  it("shows EMI schedule installments and handles an empty schedule", () => {
    const installment = render(<EmiSchedule expense={{ id: "emi", title: "Laptop", category: "Electronics", amount: 1200, date: "2099-01-01", months: 3 }} onClose={() => undefined} />);
    expect(installment.getByText("EMI schedule")).toBeTruthy();
    expect(installment.getByText(/Installment\s*1/)).toBeTruthy();
    expect(installment.getByText(/Installment\s*3/)).toBeTruthy();
    const empty = render(<EmiSchedule expense={{ id: "zero", title: "Invalid", category: "Other", amount: 0, date: "2099-01-01", months: 0 }} onClose={() => undefined} />);
    expect(empty.getByText("0 paid · 0 remaining")).toBeTruthy();
  });
});

describe("native import, receipt, and voice forms", () => {
  const filePicker = mockFor<{ getDocumentAsync: AsyncMock }>("expo-document-picker");
  const fileSystem = mockFor<{ readAsStringAsync: AsyncMock; writeAsStringAsync: AsyncMock }>("expo-file-system");
  const sharing = mockFor<{ isAvailableAsync: AsyncMock; shareAsync: AsyncMock }>("expo-sharing");
  const camera = mockFor<{ CameraView: { isDocumentScannerAvailable: boolean; scanDocumentAsync: AsyncMock } }>("expo-camera");
  const textExtractor = mockFor<{ extractTextFromImage: AsyncMock }>("expo-text-extractor");
  const speech = mockFor<{ ExpoSpeechRecognitionModule: { start: jest.Mock; stop: jest.Mock; requestPermissionsAsync: AsyncMock } }>("expo-speech-recognition");

  it("imports pasted statement content and disables empty imports", () => {
    const onImport = jest.fn();
    const form = render(<DataTransferForm exportData="{}" initialText={null} onImport={onImport} onClose={() => undefined} />);
    fireEvent.press(form.getByText("Import transactions"));
    expect(onImport).not.toHaveBeenCalled();
    fireEvent.changeText(form.getByDisplayValue(""), "date,description,amount\n2025-01-02,Coffee,-450");
    fireEvent.press(form.getByText("Import transactions"));
    expect(onImport).toHaveBeenCalledWith("date,description,amount\n2025-01-02,Coffee,-450");
  });

  it("shares the export, reports unavailable sharing, and cancels document selection", async () => {
    const form = render(<DataTransferForm exportData='{"expenses":[]}' onImport={() => undefined} onClose={() => undefined} />);
    fireEvent.press(form.getByText("Share export"));
    const fileSystem = mockFor<{ writeAsStringAsync: AsyncMock }>("expo-file-system");
    const sharing = mockFor<{ shareAsync: AsyncMock }>("expo-sharing");
    await waitFor(() => expect(fileSystem.writeAsStringAsync).toHaveBeenCalledWith("/cache/budget-tracker-export.json", "{\"expenses\":[]}"));
    await waitFor(() => expect(sharing.shareAsync).toHaveBeenCalled());
    fireEvent.press(form.getByText("Choose statement"));
  });

  it("reports unavailable sharing and previews text selected from a statement file", async () => {
    sharing.isAvailableAsync.mockResolvedValueOnce(false);
    filePicker.getDocumentAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ name: "bank.csv", uri: "/cache/bank.csv" }],
    });
    fileSystem.readAsStringAsync.mockResolvedValueOnce("date,description,amount\n2025-01-02,Coffee,-450");
    const form = render(<DataTransferForm exportData="{}" onImport={() => undefined} onClose={() => undefined} />);

    fireEvent.press(form.getByText("Share export"));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Sharing unavailable", "Your device does not support native sharing."));
    fireEvent.press(form.getByText("Choose statement"));
    await waitFor(() => expect(form.getByText("bank.csv · 1 transactions detected")).toBeTruthy());
    expect(form.getByText("Coffee")).toBeTruthy();
    expect(fileSystem.readAsStringAsync).toHaveBeenCalledWith("/cache/bank.csv");
  });

  it("reads Excel statements through the workbook parser", async () => {
    const xlsx = mockFor<{ read: jest.Mock; utils: { sheet_to_csv: jest.Mock } }>("xlsx");
    filePicker.getDocumentAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ name: "bank.xlsx", uri: "/cache/bank.xlsx" }],
    });
    fileSystem.readAsStringAsync.mockResolvedValueOnce("encoded-workbook");
    xlsx.read.mockReturnValueOnce({ SheetNames: ["Transactions"], Sheets: { Transactions: {} } });
    xlsx.utils.sheet_to_csv.mockReturnValueOnce("date,description,amount\n2025-01-02,Coffee,-450");
    const form = render(<DataTransferForm exportData="{}" onImport={() => undefined} onClose={() => undefined} />);

    fireEvent.press(form.getByText("Choose statement"));
    await waitFor(() => expect(form.getByText("bank.xlsx · 1 transactions detected")).toBeTruthy());
    expect(fileSystem.readAsStringAsync).toHaveBeenCalledWith("/cache/bank.xlsx", { encoding: "base64" });
    expect(xlsx.read).toHaveBeenCalledWith("encoded-workbook", { type: "base64", cellDates: true });
  });

  it("accepts shared statement content and safely handles unparseable previews", () => {
    const form = render(<DataTransferForm exportData="{}" initialText="{broken" onImport={() => undefined} onClose={() => undefined} />);
    expect(form.getByDisplayValue("{broken")).toBeTruthy();
    expect(form.getByText("Shared content · 0 transactions detected")).toBeTruthy();
  });

  it("extracts shared receipt text, parses the merchant and confirms the expense", async () => {
    const onSave = jest.fn();
    const scanner = render(<ReceiptScanner initialImageUri="/tmp/receipt.jpg" onClose={() => undefined} onSave={onSave} />);
    const textExtractor = mockFor<{ extractTextFromImage: AsyncMock }>("expo-text-extractor");
    await waitFor(() => expect(textExtractor.extractTextFromImage).toHaveBeenCalledWith("/tmp/receipt.jpg"));
    expect(scanner.getByText("Cafe Luna")).toBeTruthy();
    expect(scanner.getByText("Confirm and save")).toBeTruthy();
    fireEvent.press(scanner.getByText("Confirm and save"));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "Cafe Luna", amount: 450 }));
  });

  it("handles unavailable camera, missing pages, empty OCR, and scanner errors", async () => {
    const cameraUnavailable = render(<ReceiptScanner onClose={() => undefined} onSave={() => undefined} />);
    fireEvent.press(cameraUnavailable.getByText("Scan with camera"));
    expect(Alert.alert).toHaveBeenCalledWith("Scanner unavailable", "Use a development build on a device with a supported document scanner.");

    camera.CameraView.isDocumentScannerAvailable = true;
    camera.CameraView.scanDocumentAsync.mockResolvedValueOnce({ pages: [] });
    const noPage = render(<ReceiptScanner onClose={() => undefined} onSave={() => undefined} />);
    fireEvent.press(noPage.getByText("Scan with camera"));
    await waitFor(() => expect(camera.CameraView.scanDocumentAsync).toHaveBeenCalled());

    camera.CameraView.scanDocumentAsync.mockResolvedValueOnce({ pages: ["/tmp/blank.jpg"] });
    textExtractor.extractTextFromImage.mockResolvedValueOnce([]);
    const blank = render(<ReceiptScanner onClose={() => undefined} onSave={() => undefined} />);
    fireEvent.press(blank.getByText("Scan with camera"));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("No text found", "Try a flatter, brighter photo of the receipt."));

    camera.CameraView.scanDocumentAsync.mockRejectedValueOnce(new Error("camera error"));
    const failed = render(<ReceiptScanner onClose={() => undefined} onSave={() => undefined} />);
    fireEvent.press(failed.getByText("Scan with camera"));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Receipt scan failed", "camera error"));
    camera.CameraView.isDocumentScannerAvailable = false;
  });

  it("handles receipt OCR failures from shared images", async () => {
    textExtractor.extractTextFromImage.mockRejectedValueOnce(new Error("OCR unavailable"));
    render(<ReceiptScanner initialImageUri="/tmp/broken.jpg" onClose={() => undefined} onSave={() => undefined} />);
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Receipt scan failed", "OCR unavailable"));
    textExtractor.extractTextFromImage.mockRejectedValueOnce("unknown");
    render(<ReceiptScanner initialImageUri="/tmp/broken-again.jpg" onClose={() => undefined} onSave={() => undefined} />);
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Receipt scan failed", "Try importing the image again."));
  });

  it("requests speech permission and provides a manual-entry fallback", async () => {
    const voice = render(<VoiceExpenseForm onClose={() => undefined} onSave={() => undefined} />);
    fireEvent.press(voice.getByLabelText("Start voice expense entry"));
    const speech = mockFor<{ ExpoSpeechRecognitionModule: { requestPermissionsAsync: AsyncMock } }>("expo-speech-recognition");
    await waitFor(() => expect(speech.ExpoSpeechRecognitionModule.requestPermissionsAsync).toHaveBeenCalled());
    expect(Alert.alert).toHaveBeenCalledWith("Microphone permission needed", "Allow microphone access to use voice expense entry.");
    expect(voice.getByText("Your words will appear here.")).toBeTruthy();
  });

  it("starts speech recognition, handles result events, stops, and saves a parsed expense", async () => {
    speech.ExpoSpeechRecognitionModule.requestPermissionsAsync.mockResolvedValueOnce({ granted: true });
    const onSave = jest.fn();
    const onClose = jest.fn();
    const voice = render(<VoiceExpenseForm onClose={onClose} onSave={onSave} />);
    fireEvent.press(voice.getByLabelText("Start voice expense entry"));
    await waitFor(() => expect(speech.ExpoSpeechRecognitionModule.start).toHaveBeenCalledWith({
      lang: "en-IN", interimResults: true, continuous: false, requiresOnDeviceRecognition: false,
    }));

    act(() => mockRecognitionHandlers.start?.(undefined as never));
    expect(voice.getByLabelText("Stop listening")).toBeTruthy();
    act(() => mockRecognitionHandlers.result?.({ results: [{ transcript: "spent 450 on dinner" }] } as never));
    expect(voice.getByText("dinner")).toBeTruthy();
    fireEvent.press(voice.getByText("Confirm and save"));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "dinner", amount: 450 }));
    fireEvent.press(voice.getByLabelText("Stop listening"));
    expect(speech.ExpoSpeechRecognitionModule.stop).toHaveBeenCalled();
    act(() => mockRecognitionHandlers.end?.(undefined as never));
    fireEvent.press(voice.getByText("×"));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows speech errors and handles missing transcripts", () => {
    const voice = render(<VoiceExpenseForm onClose={() => undefined} onSave={() => undefined} />);
    act(() => mockRecognitionHandlers.result?.({ results: [] } as never));
    expect(voice.getByText("Your words will appear here.")).toBeTruthy();
    act(() => mockRecognitionHandlers.error?.({ message: "" } as never));
    expect(Alert.alert).toHaveBeenCalledWith("Voice input unavailable", "Try again or enter the expense manually.");
  });
});
