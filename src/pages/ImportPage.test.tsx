import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ImportPage from "./ImportPage";
import {
  fetchCards,
  fetchCategories,
  fetchExpenses,
  fetchIncomes,
  fetchInvestments,
} from "../services/backend.service";
import { createExpense, createIncome, createInvestmentTransaction } from "../services/backendSync";

vi.mock("../services/backend.service", () => ({
  fetchCards: vi.fn(),
  fetchCategories: vi.fn(),
  fetchExpenses: vi.fn(),
  fetchIncomes: vi.fn(),
  fetchInvestments: vi.fn(),
}));

vi.mock("../services/backendSync", () => ({
  createExpense: vi.fn(),
  createIncome: vi.fn(),
  createInvestmentTransaction: vi.fn(),
}));

vi.mock("../components/Confirm", () => ({
  showAlert: vi.fn(),
}));

describe("ImportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchCards).mockResolvedValue([{ id: "bank", title: "Main bank", totalLimit: 0 }]);
    vi.mocked(fetchCategories).mockResolvedValue([{ id: "food", title: "Food" }]);
    vi.mocked(fetchExpenses).mockResolvedValue([]);
    vi.mocked(fetchIncomes).mockResolvedValue([]);
    vi.mocked(fetchInvestments).mockResolvedValue([
      {
        id: "fund",
        name: "Index fund",
        platform: "Groww",
        type: "mutual-fund",
        quantity: 0,
        investedAmount: 0,
        currentValue: 0,
        purchaseDate: "2026-01-01",
      },
    ]);
    vi.mocked(createExpense).mockResolvedValue({ amount: 0, date: "" });
    vi.mocked(createIncome).mockResolvedValue({ source: "", amount: 0, date: "" });
    vi.mocked(createInvestmentTransaction).mockResolvedValue({
      investmentId: "fund",
      type: "buy",
      amount: 0,
      date: "",
    });
  });

  it("finds transactions after statement preamble and saves edited debits and credits to their categories", async () => {
    render(<ImportPage />);

    const file = new File(
      [
        "Statement From,01/10/2026\nAccount Number,12345\n\nDate,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance\n01/10/2026,COFFEE SHOP,,,250,,1000\n02/10/2026,SALARY,,,,5000,6000",
      ],
      "statement.csv",
      { type: "text/csv" },
    );
    fireEvent.change(await screen.findByLabelText("Select CSV or Excel statement"), {
      target: { files: [file] },
    });

    expect(await screen.findByDisplayValue("COFFEE SHOP")).toBeTruthy();
    expect(screen.getByDisplayValue("SALARY")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect((screen.getByLabelText("Select transaction 1") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));

    fireEvent.change(screen.getByLabelText("Account"), { target: { value: "bank" } });
    fireEvent.change(screen.getByLabelText("Category for expense 1"), {
      target: { value: "food" },
    });
    fireEvent.change(screen.getByLabelText("Category for income 2"), {
      target: { value: "salary" },
    });
    fireEvent.change(screen.getByLabelText("Date and time for transaction 1"), {
      target: { value: "2026-10-01T18:45" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Review import" }));
    expect(await screen.findByText("Review before saving")).toBeTruthy();
    expect(screen.getByText("2026-10-01 18:45")).toBeTruthy();
    expect(screen.getByText("Food")).toBeTruthy();
    expect(screen.getByText("Salary")).toBeTruthy();
    expect(createExpense).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save 2 transactions" }));

    await waitFor(() => {
      expect(createExpense).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: "bank",
          categoryId: "food",
          details: "COFFEE SHOP",
          amount: 250,
        }),
      );
      expect(createIncome).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: "bank",
          category: "salary",
          source: "SALARY",
          amount: 5000,
        }),
      );
    });
    const savedExpenseDate = vi.mocked(createExpense).mock.calls[0]?.[0].date;
    expect(new Date(savedExpenseDate ?? "").getTime()).toBe(new Date("2026-10-01T18:45").getTime());
    expect((await screen.findByRole("status")).textContent).toContain("Imported 2 transactions");
  });

  it("imports a selected mutual-fund row as an investment transaction and skips cleared rows", async () => {
    render(<ImportPage />);
    const file = new File(
      [
        "Date,Narration,Debit,Credit,Units\n01/10/2026,Index fund SIP,1000,,5\n02/10/2026,Groceries,500,,",
      ],
      "statement.csv",
      { type: "text/csv" },
    );
    fireEvent.change(await screen.findByLabelText("Select CSV or Excel statement"), {
      target: { files: [file] },
    });

    expect(await screen.findByDisplayValue("Index fund SIP")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Account"), { target: { value: "bank" } });
    fireEvent.change(screen.getByLabelText("Type for transaction 1"), {
      target: { value: "investment" },
    });
    fireEvent.change(await screen.findByLabelText("Investment for transaction 1"), {
      target: { value: "fund" },
    });
    fireEvent.click(screen.getByLabelText("Select transaction 2"));
    fireEvent.click(screen.getByRole("button", { name: "Review import" }));

    expect(await screen.findByText("Review before saving")).toBeTruthy();
    expect(screen.getByText("Index fund")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save 1 transactions" }));

    await waitFor(() => {
      expect(createInvestmentTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          investmentId: "fund",
          type: "buy",
          quantity: 5,
          amount: 1000,
          note: "Index fund SIP",
        }),
      );
    });
    expect(createExpense).not.toHaveBeenCalled();
    expect(createIncome).not.toHaveBeenCalled();
  });
});
