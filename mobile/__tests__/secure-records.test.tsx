import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { SecureRecordsScreen } from "../components/secure-records";
import type { SecureRecord, SecureVaultEnvelope } from "../secure-vault";

jest.mock("../secure-vault", () => ({
  createVaultSalt: jest.fn(async () => "AAECAwQFBgcICQoLDA0ODw"),
  decryptVaultRecords: jest.fn(async () => []),
  deriveVaultKey: jest.fn(async () => new Uint8Array(32)),
  encryptVaultRecords: jest.fn(async () => ({
    version: 1,
    kdfIterations: 600000,
    salt: "AAECAwQFBgcICQoLDA0ODw",
    iv: "AAECAwQFBgcICQoL",
    ciphertext: "AAECAwQFBgcICQoLDA0ODw",
  })),
  fetchSecureVault: jest.fn(async () => null),
  isValidCardCvv: (value: string) => /^\d{3,4}$/.test(value),
  isValidCardExpiry: (value: string) => /^(0[1-9]|1[0-2])\/\d{2}$/.test(value),
  isValidCardNumber: (value: string) => /^\d{12,19}$/.test(value),
  isValidCardPin: (value: string) => /^\d{4,6}$/.test(value),
  normalizeCardNumber: (value: string) => value.replace(/[\s-]/g, ""),
  saveSecureVault: jest.fn(async () => undefined),
}));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock("expo-crypto", () => ({ randomUUID: () => "mobile-record-id" }));

const vault = jest.requireMock("../secure-vault") as {
  encryptVaultRecords: {
    mock: { calls: unknown[][] };
    mockResolvedValue(value: SecureVaultEnvelope): void;
  };
  fetchSecureVault: { mockResolvedValue(value: SecureVaultEnvelope | null): void };
};

describe("secure records mobile screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    vault.fetchSecureVault.mockResolvedValue(null);
    vault.encryptVaultRecords.mockResolvedValue({
      version: 1,
      kdfIterations: 600000,
      salt: "AAECAwQFBgcICQoLDA0ODw",
      iv: "AAECAwQFBgcICQoL",
      ciphertext: "AAECAwQFBgcICQoLDA0ODw",
    } satisfies SecureVaultEnvelope);
  });

  it("creates a vault and removes card secrets when changing the record type", async () => {
    const screen = render(<SecureRecordsScreen view="credentials" darkMode={false} />);
    await waitFor(() => expect(screen.getByText("Create your vault")).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText("Vault passphrase"), "correct horse battery staple");
    fireEvent.changeText(screen.getByLabelText("Confirm passphrase"), "correct horse battery staple");
    fireEvent.press(screen.getByText("Create encrypted vault"));
    await waitFor(() => expect(screen.getByText("Add a secure record")).toBeTruthy());

    fireEvent.changeText(screen.getByLabelText("Name / account label"), "Primary card");
    fireEvent.press(screen.getAllByText("Payment card")[0]);
    fireEvent.changeText(screen.getByLabelText("Full card number"), "4111111111111111");
    fireEvent.changeText(screen.getByLabelText("Expiry (MM/YY)"), "12/30");
    fireEvent.changeText(screen.getByLabelText("CVV"), "123");
    fireEvent.press(screen.getAllByText("Password")[0]);
    expect(screen.queryByLabelText("Full card number")).toBeNull();
    fireEvent.changeText(screen.getByLabelText("Password"), "new-secret");
    fireEvent.press(screen.getByText("Add record"));

    await waitFor(() => expect(vault.encryptVaultRecords).toHaveBeenCalledTimes(2));
    const savedRecords = vault.encryptVaultRecords.mock.calls[1][0] as SecureRecord[];
    expect(savedRecords).toEqual([{
      type: "password",
      title: "Primary card",
      provider: undefined,
      website: undefined,
      notes: undefined,
      username: undefined,
      password: "new-secret",
      id: "mobile-record-id",
    }]);
    expect(savedRecords[0]).not.toHaveProperty("cardNumber");
    expect(savedRecords[0]).not.toHaveProperty("cardCvv");
  });
});
