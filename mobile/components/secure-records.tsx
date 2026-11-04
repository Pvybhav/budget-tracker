import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Crypto from "expo-crypto";
import {
  createVaultSalt,
  decryptVaultRecords,
  deriveVaultKey,
  encryptVaultRecords,
  fetchSecureVault,
  isValidCardCvv,
  isValidCardExpiry,
  isValidCardNumber,
  isValidCardPin,
  normalizeCardNumber,
  saveSecureVault,
  type SecureRecord,
  type SecureRecordType,
  type SecureVaultEnvelope,
} from "../secure-vault";
import { styles } from "./styles";

type ViewType = "credentials" | "personal";
type RecordDraft = Omit<SecureRecord, "id">;
type VaultKey = Awaited<ReturnType<typeof deriveVaultKey>>;

const CREDENTIAL_TYPES: { value: SecureRecordType; label: string }[] = [
  { value: "password", label: "Password" },
  { value: "bank-login", label: "Bank account" },
  { value: "netbanking", label: "Netbanking" },
  { value: "card", label: "Payment card" },
  { value: "other", label: "Other login" },
];
const PERSONAL_TYPES: { value: SecureRecordType; label: string }[] = [
  { value: "nominee", label: "Nominee" },
  { value: "emergency-contact", label: "Emergency contact" },
  { value: "document", label: "Document reference" },
  { value: "other", label: "Other information" },
];
const emptyDraft = (type: SecureRecordType): RecordDraft => ({ type, title: "" });

function getSafeWebsiteUrl(website: string): string | null {
  try {
    const url = new URL(website);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function draftForType(current: RecordDraft, type: SecureRecordType): RecordDraft {
  const shared = { type, title: current.title, provider: current.provider, website: current.website, notes: current.notes };
  if (type === "card") {
    return {
      ...shared,
      cardholderName: current.cardholderName,
      cardNumber: current.cardNumber,
      cardExpiry: current.cardExpiry,
      cardCvv: current.cardCvv,
      cardPin: current.cardPin,
      cardLastFour: current.cardLastFour,
    };
  }
  if (type === "password") return { ...shared, username: current.username, password: current.password };
  if (type === "bank-login" || type === "netbanking") {
    return {
      ...shared,
      username: current.username,
      password: current.password,
      accountNumber: current.accountNumber,
      ifscCode: current.ifscCode,
    };
  }
  if (type === "nominee") {
    return {
      ...shared,
      relationship: current.relationship,
      contact: current.contact,
      allocation: current.allocation,
    };
  }
  if (type === "emergency-contact") {
    return { ...shared, relationship: current.relationship, contact: current.contact };
  }
  if (type === "document") return { ...shared, accountNumber: current.accountNumber };
  return shared;
}

export function SecureRecordsScreen({ view, darkMode }: { view: ViewType; darkMode: boolean }) {
  const isCredentials = view === "credentials";
  const allowedTypes = isCredentials ? CREDENTIAL_TYPES : PERSONAL_TYPES;
  const pageTitle = isCredentials ? "Passwords & account details" : "Nominees & personal records";
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [envelope, setEnvelope] = useState<SecureVaultEnvelope | null>(null);
  const [vaultKey, setVaultKey] = useState<VaultKey | null>(null);
  const [records, setRecords] = useState<SecureRecord[]>([]);
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [draftError, setDraftError] = useState("");
  const [message, setMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [draft, setDraft] = useState<RecordDraft>(() => emptyDraft(allowedTypes[0].value));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [selectedType, setSelectedType] = useState<SecureRecordType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let active = true;
    void fetchSecureVault()
      .then((result) => {
        if (active) setEnvelope(result);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Could not load the secure vault.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleRecords = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return records.filter((record) => (
      allowedTypes.some(({ value }) => value === record.type) &&
      (!isCredentials || selectedType === "all" || record.type === selectedType) &&
      (!query || [record.title, record.provider, record.username, record.website].some((value) => value?.toLocaleLowerCase().includes(query)))
    ));
  }, [records, allowedTypes, isCredentials, selectedType, searchQuery]);

  const updateDraft = (field: Exclude<keyof RecordDraft, "type">, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const lockVault = () => {
    setVaultKey(null);
    setRecords([]);
    setPassphrase("");
    setConfirmation("");
    setDraft(emptyDraft(allowedTypes[0].value));
    setRevealedIds(new Set());
    setExpandedIds(new Set());
    setCopyMessage("");
    setEditingId(null);
    setMessage("");
    setUnlockError("");
  };

  const handleUnlock = async () => {
    setUnlockError("");
    if (passphrase.length < 12) {
      setUnlockError("Use a vault passphrase with at least 12 characters.");
      return;
    }
    if (!envelope && passphrase !== confirmation) {
      setUnlockError("The passphrases do not match.");
      return;
    }
    setUnlocking(true);
    try {
      const salt = envelope?.salt ?? await createVaultSalt();
      const key = await deriveVaultKey(passphrase, salt);
      const existingRecords = envelope ? await decryptVaultRecords(envelope, key) : [];
      const newEnvelope = envelope ?? await encryptVaultRecords([], key, salt);
      if (!envelope) await saveSecureVault(newEnvelope);
      setVaultKey(key);
      setRecords(existingRecords);
      setEnvelope(newEnvelope);
      setPassphrase("");
      setConfirmation("");
      if (!envelope) setMessage("Encrypted vault created.");
    } catch (error) {
      setUnlockError(
        envelope
          ? "Could not unlock the vault. Check the passphrase or restore a valid backup."
          : error instanceof Error
            ? `Could not create or save the encrypted vault: ${error.message}`
            : "Could not create or save the encrypted vault.",
      );
    } finally {
      setUnlocking(false);
    }
  };

  const persistRecords = async (updatedRecords: SecureRecord[]): Promise<boolean> => {
    if (!vaultKey || !envelope) return false;
    setSaving(true);
    setMessage("");
    try {
      const encrypted = await encryptVaultRecords(updatedRecords, vaultKey, envelope.salt);
      await saveSecureVault(encrypted);
      setRecords(updatedRecords);
      setEnvelope(encrypted);
      setMessage("Changes encrypted and saved.");
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? `Save failed: ${error.message}` : "Save failed.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    if (!vaultKey || !draft.title.trim() || saving) return;
    if (draft.type === "card") {
      if (!draft.cardNumber || !isValidCardNumber(draft.cardNumber)) {
        setDraftError("Enter a valid card number (12–19 digits). Spaces and hyphens are allowed.");
        return;
      }
      if (!draft.cardExpiry || !isValidCardExpiry(draft.cardExpiry)) {
        setDraftError("Enter a current or future card expiry in MM/YY format.");
        return;
      }
      if (draft.cardCvv && !isValidCardCvv(draft.cardCvv)) {
        setDraftError("CVV must be 3 or 4 digits.");
        return;
      }
      if (draft.cardPin && !isValidCardPin(draft.cardPin)) {
        setDraftError("Card PIN must be 4 to 6 digits.");
        return;
      }
    }
    setDraftError("");
    const normalizedCardNumber = draft.type === "card" && draft.cardNumber
      ? normalizeCardNumber(draft.cardNumber)
      : undefined;
    const record = {
      ...draft,
      title: draft.title.trim(),
      ...(normalizedCardNumber
        ? { cardNumber: normalizedCardNumber, cardLastFour: normalizedCardNumber.slice(-4) }
        : {}),
    };
    const updatedRecords = editingId
      ? records.map((item) => item.id === editingId ? { ...record, id: editingId } : item)
      : [...records, { ...record, id: Crypto.randomUUID() }];
    if (!(await persistRecords(updatedRecords))) return;
    setDraft(emptyDraft(allowedTypes[0].value));
    setEditingId(null);
  };

  const editRecord = (record: SecureRecord) => {
    setEditingId(record.id);
    const { id: _id, ...recordDraft } = record;
    void _id;
    setDraft(recordDraft);
    setDraftError("");
  };

  const deleteRecord = (record: SecureRecord) => {
    Alert.alert("Delete secure record", `Delete "${record.title}" from the vault?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void persistRecords(records.filter(({ id }) => id !== record.id)),
      },
    ]);
  };

  const toggleReveal = (recordId: string, field: string) => {
    const key = `${recordId}:${field}`;
    setRevealedIds((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const copyToClipboard = async (label: string, value: string) => {
    setCopyMessage("");
    try {
      const copied = await Clipboard.setStringAsync(value);
      setCopyMessage(copied ? `${label} copied to clipboard.` : `Could not copy ${label.toLowerCase()}.`);
    } catch {
      setCopyMessage(`Could not copy ${label.toLowerCase()}. Clipboard access is unavailable.`);
    }
  };

  const openWebsite = async (website: string) => {
    const safeUrl = getSafeWebsiteUrl(website);
    if (!safeUrl) return;
    try {
      await Linking.openURL(safeUrl);
    } catch (error) {
      Alert.alert("Could not open link", error instanceof Error ? error.message : "The link could not be opened.");
    }
  };

  const controlStyle = [styles.secureInput, darkMode && styles.darkControl, darkMode && styles.darkText];
  const renderField = (
    field: Exclude<keyof RecordDraft, "type">,
    label: string,
    options: { secure?: boolean; numeric?: boolean; multiline?: boolean; maxLength?: number; placeholder?: string } = {},
  ) => (
    <View key={field} style={styles.secureField}>
      <Text style={[styles.fieldLabel, darkMode && styles.darkText]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={draft[field] ?? ""}
        onChangeText={(value) => updateDraft(field, value)}
        secureTextEntry={options.secure}
        keyboardType={options.numeric ? "numeric" : "default"}
        multiline={options.multiline}
        maxLength={options.maxLength}
        placeholder={options.placeholder}
        placeholderTextColor="#95a2b1"
        autoCapitalize="none"
        autoCorrect={false}
        style={[...controlStyle, options.multiline && styles.secureMultiline]}
      />
    </View>
  );

  const fieldValue = (record: SecureRecord, key: keyof RecordDraft, label: string, sensitive = false) => {
    const value = record[key];
    if (!value) return null;
    const revealed = revealedIds.has(`${record.id}:${key}`);
    const copyable = key === "password" || key === "username";
    const masked = key === "cardNumber"
      ? `${value.slice(0, -4).replace(/\d/g, "•").replace(/(.{4})/g, "$1 ")}${value.slice(-4)}`
      : key === "cardCvv" ? "••••" : key === "cardPin" ? "••••••" : "••••••••";
    return (
      <View key={key} style={styles.secureDetail}>
        <Text style={[styles.secureDetailLabel, darkMode && styles.darkText]}>{label}</Text>
        <Text selectable style={[styles.secureDetailValue, darkMode && styles.darkText, sensitive && styles.secureMonospace]}>
          {sensitive && !revealed ? masked : key === "cardNumber" ? value.replace(/(\d{4})(?=\d)/g, "$1 ") : value}
        </Text>
        {(sensitive || copyable) && (
          <View style={styles.secureInlineActions}>
            {sensitive && <Pressable onPress={() => toggleReveal(record.id, key)}><Text style={styles.link}>{revealed ? "Hide" : "Reveal"}</Text></Pressable>}
            {copyable && (
              <Pressable onPress={() => void copyToClipboard(label, value)}><Text style={styles.link}>Copy</Text></Pressable>
            )}
          </View>
        )}
      </View>
    );
  };

  const recordFields = (record: SecureRecord) => (
    <View style={styles.secureDetails}>
      {record.provider && <Detail label="Provider" value={record.provider} darkMode={darkMode} />}
      {record.website && (
        <View style={styles.secureDetail}>
          <Text style={[styles.secureDetailLabel, darkMode && styles.darkText]}>Website / reference</Text>
          <Text selectable style={[styles.secureDetailValue, darkMode && styles.darkText]}>{record.website}</Text>
          {getSafeWebsiteUrl(record.website) && (
            <Pressable accessibilityRole="link" onPress={() => void openWebsite(record.website ?? "")}>
              <Text style={styles.link}>Open link</Text>
            </Pressable>
          )}
        </View>
      )}
      {fieldValue(record, "username", "Username")}
      {fieldValue(record, "password", "Password", true)}
      {record.accountNumber && <Detail label={record.type === "document" ? "Document reference" : "Account number"} value={record.accountNumber} darkMode={darkMode} />}
      {record.ifscCode && <Detail label="IFSC / routing code" value={record.ifscCode} darkMode={darkMode} />}
      {record.cardholderName && <Detail label="Cardholder" value={record.cardholderName} darkMode={darkMode} />}
      {record.cardNumber && fieldValue(record, "cardNumber", "Card number", true)}
      {!record.cardNumber && record.cardLastFour && <Detail label="Card ending" value={`•••• ${record.cardLastFour}`} darkMode={darkMode} />}
      {record.cardExpiry && <Detail label="Expiry" value={record.cardExpiry} darkMode={darkMode} />}
      {fieldValue(record, "cardCvv", "CVV", true)}
      {fieldValue(record, "cardPin", "Card PIN", true)}
      {record.relationship && <Detail label="Relationship" value={record.relationship} darkMode={darkMode} />}
      {record.contact && <Detail label="Contact" value={record.contact} darkMode={darkMode} />}
      {record.allocation && <Detail label="Allocation / share" value={record.allocation} darkMode={darkMode} />}
      {record.notes && <Detail label="Notes" value={record.notes} darkMode={darkMode} />}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={[styles.scroll, darkMode && styles.darkScroll]} keyboardShouldPersistTaps="handled">
      <View style={styles.pageIntroRow}>
        <View style={styles.secureHeading}>
          <Text style={[styles.pageTitle, darkMode && styles.darkText]}>{pageTitle}</Text>
          <Text style={styles.muted}>Encrypted on this device before syncing to your account.</Text>
        </View>
        {vaultKey && <Pressable accessibilityRole="button" onPress={lockVault} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Lock vault</Text></Pressable>}
      </View>
      <View style={[styles.secureWarning, darkMode && styles.darkSecureWarning]}>
        <Text style={[styles.secureWarningTitle, darkMode && styles.darkSecureWarningTitle]}>Keep your passphrase safe</Text>
        <Text style={[styles.secureWarningText, darkMode && styles.darkSecureWarningText]}>
          It cannot be reset. Full card numbers, CVVs, and PINs are encrypted and masked by default.
          Use a trusted, private device and prefer your bank’s app for sensitive details.
        </Text>
      </View>
      {loading ? (
        <Text style={styles.muted}>Loading encrypted vault…</Text>
      ) : loadError ? (
        <View style={[styles.secureCard, darkMode && styles.darkSecureCard]}>
          <Text style={styles.secureError}>Could not check the vault status: {loadError}</Text>
          <Pressable style={styles.secondaryButton} onPress={() => {
            setLoading(true);
            setLoadError("");
            void fetchSecureVault().then(setEnvelope).catch((error: unknown) => {
              setLoadError(error instanceof Error ? error.message : "Could not load the secure vault.");
            }).finally(() => setLoading(false));
          }}><Text style={styles.secondaryButtonText}>Retry</Text></Pressable>
        </View>
      ) : !vaultKey ? (
        <View style={[styles.secureCard, darkMode && styles.darkSecureCard]}>
          <Text style={[styles.sectionTitle, darkMode && styles.darkText]}>{envelope ? "Unlock your vault" : "Create your vault"}</Text>
          <View style={styles.secureField}>
            <Text style={[styles.fieldLabel, darkMode && styles.darkText]}>Vault passphrase</Text>
            <TextInput accessibilityLabel="Vault passphrase" value={passphrase} onChangeText={setPassphrase} secureTextEntry autoCapitalize="none" autoCorrect={false} style={controlStyle} />
            <Text style={styles.muted}>At least 12 characters; different from your account password.</Text>
          </View>
          {!envelope && (
            <View style={styles.secureField}>
              <Text style={[styles.fieldLabel, darkMode && styles.darkText]}>Confirm passphrase</Text>
              <TextInput accessibilityLabel="Confirm passphrase" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoCapitalize="none" autoCorrect={false} style={controlStyle} />
            </View>
          )}
          {!!unlockError && <Text accessibilityRole="alert" style={styles.secureError}>{unlockError}</Text>}
          <Pressable style={styles.primaryButton} onPress={() => void handleUnlock()} disabled={unlocking}>
            <Text style={styles.primaryButtonText}>{unlocking ? "Deriving encryption key…" : envelope ? "Unlock vault" : "Create encrypted vault"}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={[styles.secureCard, darkMode && styles.darkSecureCard]}>
            <Text style={[styles.sectionTitle, darkMode && styles.darkText]}>{editingId ? "Edit record" : "Add a secure record"}</Text>
            <Text style={[styles.fieldLabel, darkMode && styles.darkText]}>Record type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.secureTypeRow}>
              {allowedTypes.map((option) => (
                <Pressable key={option.value} onPress={() => setDraft((current) => draftForType(current, option.value))} style={[styles.filterChip, draft.type === option.value && styles.filterChipActive]}>
                  <Text style={[styles.filterText, draft.type === option.value && styles.filterTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {renderField("title", isCredentials ? "Name / account label" : "Name / record title", { placeholder: "e.g. Main savings account" })}
            {renderField("provider", isCredentials ? "Bank / provider" : "Associated bank / policy / institution")}
            {renderField("website", "Login URL / reference link", { placeholder: "https://" })}
            {isCredentials && renderField("username", "Username / customer ID")}
            {isCredentials && draft.type !== "card" && renderField("password", "Password", { secure: true })}
            {isCredentials && ["bank-login", "netbanking"].includes(draft.type) && (
              <>
                {renderField("accountNumber", "Account number", { numeric: true })}
                {renderField("ifscCode", "IFSC / routing code")}
              </>
            )}
            {isCredentials && draft.type === "card" && (
              <>
                {renderField("cardholderName", "Name on card")}
                {renderField("cardNumber", "Full card number", { numeric: true, maxLength: 23, placeholder: "1234 5678 9012 3456" })}
                {renderField("cardExpiry", "Expiry (MM/YY)", { maxLength: 5, placeholder: "MM/YY" })}
                {renderField("cardCvv", "CVV", { secure: true, numeric: true, maxLength: 4 })}
                {renderField("cardPin", "Card PIN", { secure: true, numeric: true, maxLength: 6 })}
              </>
            )}
            {!isCredentials && draft.type === "nominee" && (
              <>
                {renderField("relationship", "Relationship")}
                {renderField("contact", "Contact details")}
                {renderField("allocation", "Allocation / share", { placeholder: "e.g. 50%" })}
              </>
            )}
            {!isCredentials && draft.type === "emergency-contact" && (
              <>
                {renderField("relationship", "Relationship")}
                {renderField("contact", "Contact details")}
              </>
            )}
            {!isCredentials && draft.type === "document" && renderField("accountNumber", "Document / policy reference number")}
            {renderField("notes", "Notes", { multiline: true })}
            {!!draftError && <Text accessibilityRole="alert" style={styles.secureError}>{draftError}</Text>}
            <View style={styles.secureButtonRow}>
              <Pressable style={[styles.primaryButton, saving && styles.secureDisabled]} onPress={() => void saveDraft()} disabled={saving || !draft.title.trim()}>
                <Text style={styles.primaryButtonText}>{saving ? "Encrypting and saving…" : editingId ? "Save changes" : "Add record"}</Text>
              </Pressable>
              {editingId && <Pressable style={styles.secondaryButton} onPress={() => { setEditingId(null); setDraft(emptyDraft(allowedTypes[0].value)); setDraftError(""); }}><Text style={styles.secondaryButtonText}>Cancel edit</Text></Pressable>}
            </View>
            {!!message && <Text accessibilityRole="status" style={styles.muted}>{message}</Text>}
          </View>
          <View style={styles.secureListHeader}>
            <Text style={[styles.sectionTitle, darkMode && styles.darkText]}>{pageTitle} ({visibleRecords.length})</Text>
          </View>
          {isCredentials && (
            <>
              <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search by name, provider, or username" placeholderTextColor="#95a2b1" style={controlStyle} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.secureTypeRow}>
                {[{ value: "all" as const, label: "All" }, ...CREDENTIAL_TYPES].map((option) => (
                  <Pressable key={option.value} onPress={() => setSelectedType(option.value)} style={[styles.filterChip, selectedType === option.value && styles.filterChipActive]}>
                    <Text style={[styles.filterText, selectedType === option.value && styles.filterTextActive]}>{option.label === "Bank account" ? "Bank logins" : option.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}
          {!!copyMessage && <Text accessibilityRole="status" style={styles.muted}>{copyMessage}</Text>}
          {visibleRecords.length === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.sectionTitle, darkMode && styles.darkText]}>{searchQuery.trim() || selectedType !== "all" ? "No matching records found." : "No records here yet."}</Text>
            </View>
          ) : visibleRecords.map((record) => (
            <View key={record.id} style={[styles.secureRecordCard, darkMode && styles.darkControl]}>
              <View style={styles.secureRecordHeader}>
                <Text style={[styles.secureRecordTitle, darkMode && styles.darkText]}>{record.title}</Text>
                <View style={styles.secureInlineActions}>
                  <Pressable onPress={() => setExpandedIds((current) => {
                    const next = new Set(current);
                    if (next.has(record.id)) next.delete(record.id);
                    else next.add(record.id);
                    return next;
                  })}><Text style={styles.link}>{expandedIds.has(record.id) ? "View less" : "View more"}</Text></Pressable>
                  <Pressable onPress={() => editRecord(record)}><Text style={styles.link}>Edit</Text></Pressable>
                  <Pressable accessibilityLabel={`Delete ${record.title}`} onPress={() => deleteRecord(record)}><Text style={styles.secureDelete}>Delete</Text></Pressable>
                </View>
              </View>
              {expandedIds.has(record.id) && recordFields(record)}
            </View>
          ))}
          <Text style={styles.secureFootnote}>
            AES-256-GCM; PBKDF2-SHA-256 (600,000 iterations). The passphrase and decrypted records are not sent to or saved by the server.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

function Detail({ label, value, darkMode }: { label: string; value: string; darkMode: boolean }) {
  return (
    <View style={styles.secureDetail}>
      <Text style={[styles.secureDetailLabel, darkMode && styles.darkText]}>{label}</Text>
      <Text selectable style={[styles.secureDetailValue, darkMode && styles.darkText]}>{value}</Text>
    </View>
  );
}
