import * as Crypto from "expo-crypto";
import { gcm } from "@noble/ciphers/aes";
import { bytesToUtf8, utf8ToBytes } from "@noble/ciphers/utils";
import { pbkdf2Async } from "@noble/hashes/pbkdf2";
import { sha256 } from "@noble/hashes/sha256";
import { apiRequest } from "./api";

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
const VAULT_AAD = utf8ToBytes("budget-tracker-secure-vault:v1");
const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
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

function toBase64Url(bytes: Uint8Array): string {
  let base64 = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    base64 += BASE64_CHARS[first >> 2];
    base64 += BASE64_CHARS[((first & 3) << 4) | ((second ?? 0) >> 4)];
    base64 += second === undefined ? "=" : BASE64_CHARS[((second & 15) << 2) | ((third ?? 0) >> 6)];
    base64 += third === undefined ? "=" : BASE64_CHARS[third & 63];
  }
  return base64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const bytes: number[] = [];
  for (let index = 0; index < padded.length; index += 4) {
    const a = BASE64_CHARS.indexOf(padded[index]);
    const b = BASE64_CHARS.indexOf(padded[index + 1]);
    const c = padded[index + 2] === "=" ? 0 : BASE64_CHARS.indexOf(padded[index + 2]);
    const d = padded[index + 3] === "=" ? 0 : BASE64_CHARS.indexOf(padded[index + 3]);
    if (a < 0 || b < 0 || c < 0 || d < 0) throw new Error("Vault data has an invalid format.");
    bytes.push((a << 2) | (b >> 4));
    if (padded[index + 2] !== "=") bytes.push(((b & 15) << 4) | (c >> 2));
    if (padded[index + 3] !== "=") bytes.push(((c & 3) << 6) | d);
  }
  return Uint8Array.from(bytes);
}

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

export async function createVaultSalt(): Promise<string> {
  return toBase64Url(await Crypto.getRandomBytesAsync(16));
}

export async function deriveVaultKey(passphrase: string, salt: string): Promise<Uint8Array> {
  if (passphrase.length < 12) {
    throw new Error("Vault passphrase must be at least 12 characters.");
  }
  if (!/^[A-Za-z0-9_-]{22}$/.test(salt)) {
    throw new Error("Vault salt has an invalid format.");
  }
  return pbkdf2Async(sha256, utf8ToBytes(passphrase), fromBase64Url(salt), {
    c: KDF_ITERATIONS,
    dkLen: 32,
    asyncTick: 100,
  });
}

export async function encryptVaultRecords(
  records: SecureRecord[],
  key: Uint8Array,
  salt: string,
): Promise<SecureVaultEnvelope> {
  const iv = await Crypto.getRandomBytesAsync(12);
  const ciphertext = gcm(key, iv, VAULT_AAD).encrypt(utf8ToBytes(JSON.stringify(records)));
  return {
    version: 1,
    kdfIterations: KDF_ITERATIONS,
    salt,
    iv: toBase64Url(iv),
    ciphertext: toBase64Url(ciphertext),
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
  key: Uint8Array,
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
  const plaintext = gcm(key, fromBase64Url(envelope.iv), VAULT_AAD).decrypt(
    fromBase64Url(envelope.ciphertext),
  );
  const records: unknown = JSON.parse(bytesToUtf8(plaintext));
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
  const result = await apiRequest<{ vault: SecureVaultEnvelope | null }>("/secure-vault");
  return result.vault;
}

export async function saveSecureVault(vault: SecureVaultEnvelope): Promise<void> {
  await apiRequest("/secure-vault", {
    method: "PUT",
    body: JSON.stringify({ vault }),
  });
}
