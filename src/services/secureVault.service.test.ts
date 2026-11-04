import { webcrypto } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { apiGet, apiPut } from "./api";
import {
  decryptVaultRecords,
  deriveVaultKey,
  encryptVaultRecords,
  fetchSecureVault,
  saveSecureVault,
  type SecureRecord,
  type SecureVaultEnvelope,
} from "./secureVault.service";

vi.mock("./api", () => ({
  apiGet: vi.fn(),
  apiPut: vi.fn(),
}));

beforeAll(() => {
  vi.stubGlobal("crypto", webcrypto);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("secure vault encryption", () => {
  const records: SecureRecord[] = [
    {
      id: "record-1",
      type: "bank-login",
      title: "Main bank",
      username: "customer-123",
      password: "example-secret-value",
    },
  ];

  async function createKey() {
    return globalThis.crypto.subtle.importKey(
      "raw",
      new Uint8Array(32).fill(7),
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
  }

  it("derives an encryption key from the vault passphrase and salt", async () => {
    const salt = "AAECAwQFBgcICQoLDA0ODw";
    const key = await deriveVaultKey("correct horse battery staple", salt);
    const envelope = await encryptVaultRecords(records, key, salt);

    await expect(decryptVaultRecords(envelope, key)).resolves.toEqual(records);
  });

  it("encrypts records so plaintext is absent and decrypts with the right key", async () => {
    const key = await createKey();
    const envelope = await encryptVaultRecords(records, key, "AAECAwQFBgcICQoLDA0ODw");

    expect(envelope.ciphertext).not.toContain("example-secret-value");
    await expect(decryptVaultRecords(envelope, key)).resolves.toEqual(records);
  });

  it("rejects a wrong key or tampered ciphertext", async () => {
    const envelope = await encryptVaultRecords(
      records,
      await createKey(),
      "AAECAwQFBgcICQoLDA0ODw",
    );
    const wrongKey = await globalThis.crypto.subtle.importKey(
      "raw",
      new Uint8Array(32).fill(8),
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
    await expect(decryptVaultRecords(envelope, wrongKey)).rejects.toThrow();
    await expect(
      decryptVaultRecords(
        { ...envelope, ciphertext: `${envelope.ciphertext.slice(0, -1)}A` },
        await createKey(),
      ),
    ).rejects.toThrow();
  });

  it("loads the saved encrypted envelope from the API", async () => {
    const vault: SecureVaultEnvelope = {
      version: 1,
      kdfIterations: 600000,
      salt: "AAECAwQFBgcICQoLDA0ODw",
      iv: "AAECAwQFBgcICQoL",
      ciphertext: "AAECAwQFBgcICQoLDA0ODw",
    };
    vi.mocked(apiGet).mockResolvedValueOnce({ vault });

    await expect(fetchSecureVault()).resolves.toEqual(vault);
    expect(apiGet).toHaveBeenCalledWith("/secure-vault");
  });

  it("saves the encrypted envelope through the API", async () => {
    const vault: SecureVaultEnvelope = {
      version: 1,
      kdfIterations: 600000,
      salt: "AAECAwQFBgcICQoLDA0ODw",
      iv: "AAECAwQFBgcICQoL",
      ciphertext: "AAECAwQFBgcICQoLDA0ODw",
    };
    vi.mocked(apiPut).mockResolvedValueOnce(undefined);

    await expect(saveSecureVault(vault)).resolves.toBeUndefined();
    expect(apiPut).toHaveBeenCalledWith("/secure-vault", { vault });
  });
});
