import { describe, expect, it, jest } from "@jest/globals";
import {
  decryptVaultRecords,
  deriveVaultKey,
  encryptVaultRecords,
  isValidCardCvv,
  isValidCardExpiry,
  isValidCardNumber,
  isValidCardPin,
  normalizeCardNumber,
  type SecureRecord,
  type SecureVaultEnvelope,
} from "../secure-vault";

jest.mock("expo-crypto", () => ({
  getRandomBytesAsync: jest.fn(async (byteCount: number) =>
    Uint8Array.from({ length: byteCount }, (_, index) => index + 1),
  ),
  randomUUID: () => "mobile-record-id",
}));

const SALT = "AAECAwQFBgcICQoLDA0ODw";
function asArrayBufferBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(value.byteLength));
  bytes.set(value);
  return bytes;
}

const AAD = asArrayBufferBytes(new TextEncoder().encode("budget-tracker-secure-vault:v1"));
const records: SecureRecord[] = [{
  id: "shared-record",
  type: "card",
  title: "Test card",
  cardNumber: "4111111111111111",
  cardExpiry: "12/30",
  cardCvv: "123",
  cardPin: "0042",
}];

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

describe("mobile secure vault", () => {
  it("uses the same AES-GCM envelope format as the web vault in both directions", async () => {
    const rawKey = new Uint8Array(32).fill(7);
    const key = await globalThis.crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    const mobileEnvelope = await encryptVaultRecords(records, rawKey, SALT);

    const decryptedMobileEnvelope = await globalThis.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decodeBase64Url(mobileEnvelope.iv),
        additionalData: AAD,
      },
      key,
      decodeBase64Url(mobileEnvelope.ciphertext),
    );
    expect(JSON.parse(new TextDecoder().decode(decryptedMobileEnvelope))).toEqual(records);

    const iv = new Uint8Array(12).fill(9);
    const webCiphertext = await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: AAD },
      key,
      asArrayBufferBytes(new TextEncoder().encode(JSON.stringify(records))),
    );
    const webEnvelope: SecureVaultEnvelope = {
      version: 1,
      kdfIterations: 600000,
      salt: SALT,
      iv: encodeBase64Url(iv),
      ciphertext: encodeBase64Url(new Uint8Array(webCiphertext)),
    };
    await expect(decryptVaultRecords(webEnvelope, rawKey)).resolves.toEqual(records);
  });

  it("derives the exact PBKDF2-SHA-256 key used by the web implementation", async () => {
    const passphrase = "correct horse battery staple";
    const key = await deriveVaultKey(passphrase, SALT);
    const material = await globalThis.crypto.subtle.importKey("raw", asArrayBufferBytes(new TextEncoder().encode(passphrase)), "PBKDF2", false, ["deriveBits"]);
    const webKey = new Uint8Array(await globalThis.crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: decodeBase64Url(SALT), iterations: 600000, hash: "SHA-256" },
      material,
      256,
    ));
    expect(key).toEqual(webKey);
  });

  it("validates card numbers, expiries, CVVs, and PINs", () => {
    expect(normalizeCardNumber("4111 1111-1111 1111")).toBe("4111111111111111");
    expect(isValidCardNumber("4111 1111 1111 1111")).toBe(true);
    expect(isValidCardNumber("4111 1111 1111 1112")).toBe(false);
    expect(isValidCardExpiry("12/30", new Date(2026, 9, 15))).toBe(true);
    expect(isValidCardExpiry("09/26", new Date(2026, 9, 15))).toBe(false);
    expect(isValidCardCvv("123")).toBe(true);
    expect(isValidCardCvv("12a")).toBe(false);
    expect(isValidCardPin("0042")).toBe(true);
    expect(isValidCardPin("123")).toBe(false);
  });
});
