import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { CameraView } from "expo-camera";
import * as TextExtractor from "expo-text-extractor";
import * as XLSX from "xlsx";
import { calcMonthlyEmi, getEmiSchedule } from "../calculations";
import { parseReceiptText, parseStatementText, parseVoiceExpense, type ImportedStatementRow } from "../parsing";
import { moduleLabels, money } from "./constants";
import { styles } from "./styles";
import type { AccountOption, Expense, Goal, ModuleItem, ModuleKey } from "./types";

export function ReceiptScanner({ initialImageUri, onClose, onSave }: { initialImageUri?: string | null; onClose: () => void; onSave: (expense: Expense) => void }) {
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

export function VoiceExpenseForm({ onClose, onSave }: { onClose: () => void; onSave: (expense: Expense) => void }) {
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

export function DataTransferForm({ exportData, initialText, onImport, onClose }: { exportData: string; initialText?: string | null; onImport: (value: string) => void; onClose: () => void }) {
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

export function ModuleForm({ module, onClose, onSave }: { module: ModuleKey; onClose: () => void; onSave: (item: ModuleItem) => void }) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [amount, setAmount] = useState("");
  return <View style={styles.inlineForm}><View style={styles.formHeader}><Text style={styles.formTitle}>Add {moduleLabels[module].toLowerCase()}</Text><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View><Field label="Name" value={title} onChangeText={setTitle} placeholder="Enter a name" /><Field label="Details" value={detail} onChangeText={setDetail} placeholder="Optional details" /><Field label="Amount (optional)" value={amount} onChangeText={setAmount} placeholder="₹ 0" keyboardType="numeric" /><Pressable style={styles.primaryButton} onPress={() => title ? onSave({ id: "", title, detail: detail || "Added just now", amount: amount ? Number(amount) : undefined, status: module === "categories" ? "Active" : "Pending" }) : Alert.alert("Add a name", "Enter a name before saving.")}><Text style={styles.primaryButtonText}>Save record</Text></Pressable></View>;
}

export function ExpenseForm({ accounts, onClose, onSave }: { accounts: AccountOption[]; onClose: () => void; onSave: (expense: Expense) => void }) {
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

export function GoalForm({ onClose, onSave }: { onClose: () => void; onSave: (goal: Goal) => void }) { const [title, setTitle] = useState(""); const [target, setTarget] = useState(""); return <FormSheet title="New savings goal" onClose={onClose}><Text style={styles.formHint}>Give your next milestone a name and a target.</Text><Field label="Goal name" value={title} onChangeText={setTitle} placeholder="e.g. New phone" /><Field label="Target amount" value={target} onChangeText={setTarget} placeholder="₹ 0" keyboardType="numeric" /><Pressable style={styles.primaryButton} onPress={() => title && Number(target) > 0 ? onSave({ id: "", title, target: Number(target), saved: 0, color: "#2563eb" }) : Alert.alert("Add some details", "Enter a goal name and target amount.")}><Text style={styles.primaryButtonText}>Create goal</Text></Pressable></FormSheet>; }

export function FormSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <View style={styles.modalBackdrop}><View style={styles.formSheet}><View style={styles.formHeader}><Text style={styles.formTitle}>{title}</Text><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>{children}</View></View>; }

export function Field({ label, value, onChangeText, placeholder, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: "numeric" }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9aa7b5" keyboardType={keyboardType} style={styles.input} /></View>; }

export function EmiSchedule({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const months = expense.months ?? 12;
  const schedule = getEmiSchedule(expense.amount, 0, months, expense.date);
  const monthlyPayment = schedule[0]?.paymentAmount ?? calcMonthlyEmi(expense.amount, 0, months);
  return <View style={styles.modalBackdrop}><View style={styles.formSheet}><View style={styles.formHeader}><View><Text style={styles.formTitle}>EMI schedule</Text><Text style={styles.muted}>{expense.title} · {months} months</Text></View><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View><View style={styles.emiSummary}><Text style={styles.cardOverline}>MONTHLY PAYMENT</Text><Text style={styles.summaryAmount}>{money(monthlyPayment)}</Text><Text style={styles.muted}>{schedule.filter((entry) => entry.status === "completed").length} paid · {schedule.filter((entry) => entry.status !== "completed").length} remaining</Text></View><ScrollView style={styles.schedule}>{schedule.map((entry) => <View key={entry.paymentNumber} style={styles.scheduleRow}><View style={[styles.scheduleDot, entry.status === "completed" && styles.scheduleDotDone]} /><Text style={styles.scheduleMonth}>Installment {entry.paymentNumber}<Text style={styles.muted}> · {entry.dueDate}</Text></Text><Text style={[styles.scheduleStatus, entry.status === "completed" && styles.scheduleDone]}>{entry.status}</Text><Text style={styles.scheduleAmount}>{money(entry.paymentAmount)}</Text></View>)}</ScrollView></View></View>;
}
