import { apiGet, apiPut } from "./api";

export type SecureRecordType =
  | "password"
  | "bank-login"
  | "card"
  | "netbanking"
  | "nominee"
  | "emergency-contact"
  | "document"
  | "other";

export interface SecureRecord {
  id: string;
  type: SecureRecordType;
  title: string;
  provider?: string;
  website?: string;
  username?: string;
  password?: string;
  accountNumber?: string;
  ifscCode?: string;
  cardholderName?: string;
  cardNumber?: string;
  cardExpiry?: string;
  cardCvv?: string;
  cardPin?: string;
  cardLastFour?: string;
  relationship?: string;
  contact?: string;
  allocation?: string;
  notes?: string;
}

export interface SecureVaultEnvelope {
  version: 1;
  kdfIterations: 600000;
  salt: string;
  iv: string;
  ciphertext: string;
}

const KDF_ITERATIONS = 600_000;
const VAULT_AAD = new TextEncoder().encode("budget-tracker-secure-vault:v1");
const OPTIONAL_STRING_FIELDS = [
  "provider",
  "website",
  "username",
  "password",
  "accountNumber",
  "ifscCode",
  "cardholderName",
  "cardNumber",
  "cardExpiry",
  "cardCvv",
  "cardPin",
  "cardLastFour",
  "relationship",
  "contact",
  "allocation",
  "notes",
];

export function normalizeCardNumber(value: string): string {
  return value.replace(/[\s-]/g, "");
}

export function isValidCardNumber(value: string): boolean {
  const digits = normalizeCardNumber(value);
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

export function isValidCardCvv(value: string): boolean {
  return /^\d{3,4}$/.test(value);
}

export function isValidCardExpiry(value: string, now = new Date()): boolean {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(value);
  if (!match) return false;
  const expiryYear = 2000 + Number(match[2]);
  const expiryMonth = Number(match[1]);
  return (
    expiryYear > now.getFullYear() ||
    (expiryYear === now.getFullYear() && expiryMonth >= now.getMonth() + 1)
  );
}

export function isValidCardPin(value: string): boolean {
  return /^\d{4,6}$/.test(value);
}

function getCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto.getRandomValues) {
    throw new Error("Secure vault requires a browser with Web Crypto support over HTTPS.");
  }
  return globalThis.crypto;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes: Uint8Array<ArrayBuffer> = Uint8Array.from(binary, (character) =>
    character.charCodeAt(0),
  );
  return bytes;
}

export function createVaultSalt(): string {
  return toBase64Url(getCrypto().getRandomValues(new Uint8Array(16)));
}

export async function deriveVaultKey(passphrase: string, salt: string): Promise<CryptoKey> {
  if (passphrase.length < 12) {
    throw new Error("Vault passphrase must be at least 12 characters.");
  }
  if (!/^[A-Za-z0-9_-]{22}$/.test(salt)) {
    throw new Error("Vault salt has an invalid format.");
  }
  const crypto = getCrypto();
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: fromBase64Url(salt),
      iterations: KDF_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptVaultRecords(
  records: SecureRecord[],
  key: CryptoKey,
  salt: string,
): Promise<SecureVaultEnvelope> {
  const iv = getCrypto().getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(records));
  const encrypted = await getCrypto().subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: VAULT_AAD },
    key,
    plaintext,
  );
  return {
    version: 1,
    kdfIterations: KDF_ITERATIONS,
    salt,
    iv: toBase64Url(iv),
    ciphertext: toBase64Url(new Uint8Array(encrypted)),
  };
}

function isSecureRecord(value: unknown): value is SecureRecord {
  if (value == null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    record.id.length > 0 &&
    record.title.length > 0 &&
    [
      "password",
      "bank-login",
      "card",
      "netbanking",
      "nominee",
      "emergency-contact",
      "document",
      "other",
    ].includes(String(record.type)) &&
    OPTIONAL_STRING_FIELDS.every(
      (field) => record[field] === undefined || typeof record[field] === "string",
    )
  );
}

export async function decryptVaultRecords(
  envelope: SecureVaultEnvelope,
  key: CryptoKey,
): Promise<SecureRecord[]> {
  if (
    envelope.version !== 1 ||
    envelope.kdfIterations !== KDF_ITERATIONS ||
    !/^[A-Za-z0-9_-]{22}$/.test(envelope.salt) ||
    !/^[A-Za-z0-9_-]{16}$/.test(envelope.iv) ||
    !/^[A-Za-z0-9_-]{24,2800000}$/.test(envelope.ciphertext)
  ) {
    throw new Error("Vault data has an unsupported or invalid format.");
  }
  const plaintext = await getCrypto().subtle.decrypt(
    {
      name: "AES-GCM",
      iv: fromBase64Url(envelope.iv),
      additionalData: VAULT_AAD,
    },
    key,
    fromBase64Url(envelope.ciphertext),
  );
  const records: unknown = JSON.parse(new TextDecoder().decode(plaintext));
  if (
    !Array.isArray(records) ||
    records.length > 10000 ||
    !records.every(isSecureRecord) ||
    new Set(records.map((record: SecureRecord) => record.id)).size !== records.length
  ) {
    throw new Error("Vault data is invalid or damaged.");
  }
  return records;
}

export async function fetchSecureVault(): Promise<SecureVaultEnvelope | null> {
  const result = await apiGet<{ vault: SecureVaultEnvelope | null }>("/secure-vault");
  return result.vault;
}

export async function saveSecureVault(vault: SecureVaultEnvelope): Promise<void> {
  await apiPut("/secure-vault", { vault });
}
