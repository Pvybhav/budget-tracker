import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  KeyRound,
  LockKeyhole,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  UnlockKeyhole,
} from "lucide-react";
import {
  createVaultSalt,
  decryptVaultRecords,
  deriveVaultKey,
  encryptVaultRecords,
  fetchSecureVault,
  isValidCardNumber,
  isValidCardCvv,
  isValidCardExpiry,
  isValidCardPin,
  normalizeCardNumber,
  saveSecureVault,
  type SecureRecord,
  type SecureRecordType,
  type SecureVaultEnvelope,
} from "../services/secureVault.service";
import showConfirm from "../components/Confirm";

type View = "credentials" | "personal";
type RecordDraft = Omit<SecureRecord, "id">;

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
const getSafeWebsiteUrl = (website: string): string | null => {
  try {
    const url = new URL(website);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
};

export default function SecureRecordsPage({ view }: { view: View }) {
  const isCredentials = view === "credentials";
  const allowedTypes = isCredentials ? CREDENTIAL_TYPES : PERSONAL_TYPES;
  const title = isCredentials ? "Passwords & account details" : "Nominees & personal records";
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [envelope, setEnvelope] = useState<SecureVaultEnvelope | null>(null);
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [records, setRecords] = useState<SecureRecord[]>([]);
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [saving, setSaving] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [draft, setDraft] = useState<RecordDraft>(() => emptyDraft(allowedTypes[0].value));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [selectedType, setSelectedType] = useState<SecureRecordType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  const isRevealed = (recordId: string, field: string) => revealedIds.has(`${recordId}:${field}`);
  const toggleReveal = (recordId: string, field: string) => {
    const key = `${recordId}:${field}`;
    setRevealedIds((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    let active = true;
    void fetchSecureVault()
      .then((result) => {
        if (active) setEnvelope(result);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Could not load the secure vault.");
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
    return records.filter((record) => {
      const matchesType =
        allowedTypes.some(({ value }) => value === record.type) &&
        (selectedType === "all" || record.type === selectedType);
      const matchesSearch =
        !query ||
        [record.title, record.provider, record.username, record.website].some((value) =>
          value?.toLocaleLowerCase().includes(query),
        );
      return matchesType && matchesSearch;
    });
  }, [records, allowedTypes, selectedType, searchQuery]);

  const toggleExpanded = (recordId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  };

  const copyToClipboard = async (label: string, value: string) => {
    setCopyMessage("");
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} copied to clipboard.`);
    } catch {
      setCopyMessage(`Could not copy ${label.toLowerCase()}. Clipboard access is unavailable.`);
    }
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

  const handleUnlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUnlockError("");
    if (passphrase.length < 12) {
      setUnlockError("Use a vault passphrase with at least 12 characters.");
      return;
    }
    if (!envelope && passphrase !== confirmation) {
      setUnlockError("The passphrases do not match.");
      return;
    }
    try {
      const salt = envelope?.salt ?? createVaultSalt();
      const key = await deriveVaultKey(passphrase, salt);
      const existingRecords = envelope ? await decryptVaultRecords(envelope, key) : [];
      const newEnvelope = envelope ?? (await encryptVaultRecords([], key, salt));
      if (!envelope) await saveSecureVault(newEnvelope);
      setVaultKey(key);
      setRecords(existingRecords);
      setEnvelope(newEnvelope);
      setPassphrase("");
      setConfirmation("");
      if (!envelope) {
        setMessage("Encrypted vault created.");
      }
    } catch (error) {
      setUnlockError(
        envelope
          ? "Could not unlock the vault. Check the passphrase or restore a valid backup."
          : error instanceof Error
            ? `Could not create or save the encrypted vault: ${error.message}`
            : "Could not create or save the encrypted vault.",
      );
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

  const updateDraft = (field: Exclude<keyof RecordDraft, "type">, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const saveDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!vaultKey || !draft.title.trim()) return;
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
    const record = {
      ...draft,
      title: draft.title.trim(),
      ...(draft.type === "card" && draft.cardNumber
        ? {
            cardNumber: normalizeCardNumber(draft.cardNumber),
            cardLastFour: normalizeCardNumber(draft.cardNumber).slice(-4),
          }
        : {}),
    };
    const updatedRecords = editingId
      ? records.map((item) => (item.id === editingId ? { ...record, id: editingId } : item))
      : [...records, { ...record, id: crypto.randomUUID() }];
    if (!(await persistRecords(updatedRecords))) return;
    setDraft(emptyDraft(allowedTypes[0].value));
    setEditingId(null);
  };

  const editRecord = (record: SecureRecord) => {
    setEditingId(record.id);
    const { id: _id, ...recordDraft } = record;
    void _id;
    setDraft(recordDraft);
  };

  const deleteRecord = async (record: SecureRecord) => {
    const confirmed = await showConfirm(`Delete "${record.title}" from the vault?`, {
      title: "Delete secure record",
      confirmText: "Delete",
    });
    if (confirmed) await persistRecords(records.filter(({ id }) => id !== record.id));
  };

  const changeType = (type: SecureRecordType) => {
    setDraft((current) => {
      const sharedFields = {
        title: current.title,
        provider: current.provider,
        website: current.website,
        notes: current.notes,
        type,
      };
      if (type === "card") {
        return {
          ...sharedFields,
          cardholderName: current.cardholderName,
          cardNumber: current.cardNumber,
          cardExpiry: current.cardExpiry,
          cardCvv: current.cardCvv,
          cardPin: current.cardPin,
          cardLastFour: current.cardLastFour,
        };
      }
      if (type === "password") {
        return { ...sharedFields, username: current.username, password: current.password };
      }
      if (type === "bank-login" || type === "netbanking") {
        return {
          ...sharedFields,
          username: current.username,
          password: current.password,
          accountNumber: current.accountNumber,
          ifscCode: current.ifscCode,
        };
      }
      if (type === "nominee") {
        return {
          ...sharedFields,
          relationship: current.relationship,
          contact: current.contact,
          allocation: current.allocation,
        };
      }
      if (type === "emergency-contact") {
        return {
          ...sharedFields,
          relationship: current.relationship,
          contact: current.contact,
        };
      }
      if (type === "document") {
        return { ...sharedFields, accountNumber: current.accountNumber };
      }
      return sharedFields;
    });
  };

  const renderField = (
    field: Exclude<keyof RecordDraft, "type">,
    label: string,
    options: {
      type?: string;
      placeholder?: string;
      wide?: boolean;
      maxLength?: number;
      pattern?: string;
      inputMode?: "numeric";
    } = {},
  ) => (
    <label className={`block ${options.wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
      <input
        type={options.type ?? "text"}
        value={draft[field] ?? ""}
        onChange={(event) => updateDraft(field, event.target.value)}
        placeholder={options.placeholder}
        maxLength={options.maxLength}
        pattern={options.pattern}
        inputMode={options.inputMode}
        autoComplete="off"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />
    </label>
  );

  const recordFields = (record: SecureRecord) => (
    <div className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {record.provider && (
        <p>
          <span className="text-slate-500">Provider: </span>
          {record.provider}
        </p>
      )}
      {record.website && (
        <p className="break-all">
          <span className="text-slate-500">Website: </span>
          {getSafeWebsiteUrl(record.website) ? (
            <a
              href={getSafeWebsiteUrl(record.website) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline dark:text-blue-400"
            >
              {record.website}
            </a>
          ) : (
            record.website
          )}
        </p>
      )}
      {record.username && (
        <p className="break-all">
          <span className="text-slate-500">Username: </span>
          {record.username}
          <button
            type="button"
            className="ml-2 inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
            onClick={() => void copyToClipboard("Username", record.username ?? "")}
            aria-label={`Copy username for ${record.title}`}
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
        </p>
      )}
      {record.password && (
        <p>
          <span className="text-slate-500">Password: </span>
          <span className="break-all font-mono">
            {isRevealed(record.id, "password") ? record.password : "••••••••"}
          </span>
          <button
            type="button"
            className="ml-2 text-blue-600 hover:underline dark:text-blue-400"
            onClick={() => toggleReveal(record.id, "password")}
          >
            {isRevealed(record.id, "password") ? "Hide" : "Reveal"}
          </button>
          <button
            type="button"
            className="ml-2 inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
            onClick={() => void copyToClipboard("Password", record.password ?? "")}
            aria-label={`Copy password for ${record.title}`}
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
        </p>
      )}
      {record.accountNumber && (
        <p>
          <span className="text-slate-500">Account number: </span>
          {record.accountNumber}
        </p>
      )}
      {record.ifscCode && (
        <p>
          <span className="text-slate-500">IFSC / routing code: </span>
          {record.ifscCode}
        </p>
      )}
      {record.cardholderName && (
        <p>
          <span className="text-slate-500">Cardholder: </span>
          {record.cardholderName}
        </p>
      )}
      {record.cardNumber && (
        <p className="break-all">
          <span className="text-slate-500">Card number: </span>
          <span className="font-mono">
            {isRevealed(record.id, "cardNumber")
              ? record.cardNumber.replace(/(\d{4})(?=\d)/g, "$1 ")
              : `${record.cardNumber
                  .slice(0, -4)
                  .replace(/\d/g, "•")
                  .replace(/(.{4})/g, "$1 ")}${record.cardNumber.slice(-4)}`}
          </span>
          <button
            type="button"
            className="ml-2 text-blue-600 hover:underline dark:text-blue-400"
            onClick={() => toggleReveal(record.id, "cardNumber")}
          >
            {isRevealed(record.id, "cardNumber") ? "Hide" : "Reveal"}
          </button>
        </p>
      )}
      {!record.cardNumber && record.cardLastFour && (
        <p>
          <span className="text-slate-500">Card ending: </span>•••• {record.cardLastFour}
        </p>
      )}
      {record.cardExpiry && (
        <p>
          <span className="text-slate-500">Expiry: </span>
          {record.cardExpiry}
        </p>
      )}
      {record.cardCvv && (
        <p>
          <span className="text-slate-500">CVV: </span>
          <span className="font-mono">
            {isRevealed(record.id, "cardCvv") ? record.cardCvv : "••••"}
          </span>
          <button
            type="button"
            className="ml-2 text-blue-600 hover:underline dark:text-blue-400"
            aria-label={`${isRevealed(record.id, "cardCvv") ? "Hide" : "Reveal"} CVV for ${record.title}`}
            onClick={() => toggleReveal(record.id, "cardCvv")}
          >
            {isRevealed(record.id, "cardCvv") ? "Hide" : "Reveal"}
          </button>
        </p>
      )}
      {record.cardPin && (
        <p>
          <span className="text-slate-500">Card PIN: </span>
          <span className="font-mono">
            {isRevealed(record.id, "cardPin") ? record.cardPin : "••••••"}
          </span>
          <button
            type="button"
            className="ml-2 text-blue-600 hover:underline dark:text-blue-400"
            aria-label={`${isRevealed(record.id, "cardPin") ? "Hide" : "Reveal"} card PIN for ${record.title}`}
            onClick={() => toggleReveal(record.id, "cardPin")}
          >
            {isRevealed(record.id, "cardPin") ? "Hide" : "Reveal"}
          </button>
        </p>
      )}
      {record.relationship && (
        <p>
          <span className="text-slate-500">Relationship: </span>
          {record.relationship}
        </p>
      )}
      {record.contact && (
        <p>
          <span className="text-slate-500">Contact: </span>
          {record.contact}
        </p>
      )}
      {record.allocation && (
        <p>
          <span className="text-slate-500">Allocation: </span>
          {record.allocation}
        </p>
      )}
      {record.notes && (
        <p className="whitespace-pre-wrap sm:col-span-2">
          <span className="text-slate-500">Notes: </span>
          {record.notes}
        </p>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Your vault is encrypted in this browser before it is sent to the database.
          </p>
        </div>
        {vaultKey && (
          <button
            type="button"
            onClick={lockVault}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-700"
          >
            <LockKeyhole className="h-4 w-4" /> Lock vault
          </button>
        )}
      </header>

      <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          Keep your passphrase safe: it cannot be reset, and lost passphrases mean lost vault data.
          Full card numbers, CVVs, and PINs are encrypted before saving and masked by default. This
          still increases risk if your device or passphrase is compromised; use a trusted, private
          device and prefer your bank’s app for sensitive details.
        </p>
      </div>

      {loading ? (
        <p className="text-slate-500">Loading encrypted vault…</p>
      ) : loadError ? (
        <div
          role="alert"
          className="max-w-xl space-y-3 rounded-xl border border-rose-300 bg-rose-50 p-5 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
        >
          <p>Could not check the vault status: {loadError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-current px-3 py-2 text-sm font-medium"
          >
            Reload and try again
          </button>
        </div>
      ) : !vaultKey ? (
        <form
          onSubmit={handleUnlock}
          className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center gap-2">
            {envelope ? (
              <UnlockKeyhole className="h-5 w-5 text-emerald-600" />
            ) : (
              <KeyRound className="h-5 w-5 text-emerald-600" />
            )}
            <h2 className="text-lg font-semibold">
              {envelope ? "Unlock your vault" : "Create your vault"}
            </h2>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Vault passphrase</span>
            <input
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              autoComplete="new-password"
              minLength={12}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
            <span className="mt-1 block text-xs text-slate-500">
              At least 12 characters; different from your account password.
            </span>
          </label>
          {!envelope && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Confirm passphrase</span>
              <input
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="new-password"
                minLength={12}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
          )}
          {unlockError && (
            <p role="alert" className="text-sm text-rose-600">
              {unlockError}
            </p>
          )}
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
          >
            {envelope ? "Unlock vault" : "Create encrypted vault"}
          </button>
        </form>
      ) : (
        <>
          <form
            onSubmit={saveDraft}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="text-lg font-semibold">
              {editingId ? "Edit record" : "Add a secure record"}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Record type</span>
                <select
                  value={draft.type}
                  onChange={(event) => changeType(event.target.value as SecureRecordType)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                >
                  {allowedTypes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {renderField(
                "title",
                isCredentials ? "Name / account label" : "Name / record title",
                { placeholder: "e.g. Main savings account" },
              )}
              {renderField(
                "provider",
                isCredentials ? "Bank / provider" : "Associated bank / policy / institution",
              )}
              {renderField("website", "Login URL / reference link", {
                type: "url",
                placeholder: "https://",
              })}
              {isCredentials && renderField("username", "Username / customer ID")}
              {isCredentials &&
                draft.type !== "card" &&
                renderField("password", "Password", {
                  type: "password",
                  placeholder: editingId ? "Clear to remove existing password" : "",
                })}
              {isCredentials && ["bank-login", "netbanking"].includes(draft.type) && (
                <>
                  {renderField("accountNumber", "Account number")}
                  {renderField("ifscCode", "IFSC / routing code")}
                </>
              )}
              {isCredentials && draft.type === "card" && (
                <>
                  {renderField("cardholderName", "Name on card")}
                  {renderField("cardNumber", "Full card number", {
                    placeholder: "1234 5678 9012 3456",
                    maxLength: 23,
                    pattern: "[\\d\\s-]{12,23}",
                    inputMode: "numeric",
                  })}
                  {renderField("cardExpiry", "Expiry (MM/YY)", {
                    placeholder: "MM/YY",
                    maxLength: 5,
                    pattern: "(0[1-9]|1[0-2])\\/\\d{2}",
                    inputMode: "numeric",
                  })}
                  {renderField("cardCvv", "CVV (optional)", {
                    type: "password",
                    placeholder: "3 or 4 digits",
                    maxLength: 4,
                    pattern: "\\d{3,4}",
                    inputMode: "numeric",
                  })}
                  {renderField("cardPin", "Card PIN (optional)", {
                    type: "password",
                    placeholder: "4 to 6 digits",
                    maxLength: 6,
                    pattern: "\\d{4,6}",
                    inputMode: "numeric",
                  })}
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
              {!isCredentials &&
                draft.type === "document" &&
                renderField("accountNumber", "Document / policy reference number")}
              {renderField("notes", "Notes", { wide: true })}
            </div>
            {draftError && (
              <p role="alert" className="text-sm text-rose-600">
                {draftError}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving || !draft.title.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />{" "}
                {saving ? "Encrypting and saving…" : editingId ? "Save changes" : "Add record"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setDraft(emptyDraft(allowedTypes[0].value));
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 dark:border-slate-700"
                >
                  Cancel edit
                </button>
              )}
            </div>
            {message && (
              <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
                {message}
              </p>
            )}
          </form>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">
              {title} ({visibleRecords.length})
            </h2>
            {isCredentials && (
              <>
                <label className="relative block max-w-md">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by name, provider, or username"
                    aria-label="Search secure records"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </label>
                <div className="flex flex-wrap gap-2" aria-label="Filter secure records">
                  {[{ value: "all" as const, label: "All" }, ...CREDENTIAL_TYPES].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selectedType === option.value}
                      onClick={() => setSelectedType(option.value)}
                      className={`rounded-full border px-3 py-1.5 text-sm capitalize ${
                        selectedType === option.value
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {option.label === "Bank account" ? "Bank logins" : option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
            {copyMessage && (
              <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
                {copyMessage}
              </p>
            )}
            {visibleRecords.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500 dark:border-slate-700">
                {searchQuery.trim() || selectedType !== "all"
                  ? "No matching records found."
                  : "No records here yet."}
              </p>
            ) : (
              visibleRecords.map((record) => (
                <article
                  key={record.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words font-semibold">{record.title}</h3>
                      {expandedIds.has(record.id) && recordFields(record)}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(record.id)}
                        aria-expanded={expandedIds.has(record.id)}
                        className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700"
                      >
                        {expandedIds.has(record.id) ? (
                          <>
                            <ChevronUp className="h-4 w-4" /> View less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4" /> View more
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => editRecord(record)}
                        className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteRecord(record)}
                        aria-label={`Delete ${record.title}`}
                        className="rounded border border-rose-300 p-2 text-rose-600 dark:border-rose-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>
          <p className="text-xs text-slate-500">
            Encryption: AES-256-GCM; key derived from your passphrase with PBKDF2-SHA-256 (600,000
            iterations). The passphrase and decrypted records are not sent to or saved by the
            server. This encryption applies only to these pages; existing cards, insurance, and
            investment records use standard app storage.
          </p>
        </>
      )}
    </div>
  );
}
