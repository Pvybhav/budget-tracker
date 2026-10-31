import { describe, expect, it } from "@jest/globals";
import { parseReceiptText, parseStatementText, parseVoiceExpense } from "../parsing";

describe("statement parsing", () => {
  it("parses quoted CSV, debit/credit amounts, and references", () => {
    expect(parseStatementText(
      'Transaction Date,Description,Debit,Credit,Reference,Balance\n2025-01-03,"Cafe, downtown",250,,TX-1,1750\n2025-01-04,Salary,,5000,TX-2,6750',
    )).toEqual([
      {
        date: "2025-01-03",
        details: "Cafe, downtown",
        amount: 250,
        kind: "expense",
        reference: "TX-1",
        balance: 1750,
      },
      {
        date: "2025-01-04",
        details: "Salary",
        amount: 5000,
        kind: "income",
        reference: "TX-2",
        balance: 6750,
      },
    ]);
  });

  it("supports semicolon, tab, and common slash date formats", () => {
    expect(parseStatementText("date;merchant;amount\n31/01/2025;Market;1,250")).toMatchObject([
      { date: "2025-01-31", details: "Market", amount: 1250, kind: "expense" },
    ]);
    expect(parseStatementText("date\tmerchant\twithdrawal\n2025/02/03\tTaxi\t90")).toMatchObject([
      { date: "2025-02-03", details: "Taxi", amount: 90, kind: "expense" },
    ]);
  });

  it("parses JSON transaction arrays, signed income, and ignores invalid rows", () => {
    const rows = parseStatementText(JSON.stringify({
      transactions: [
        { transactionDate: "2025-03-01", narration: "Refund", amount: "-50" },
        { transactionDate: "invalid", narration: "Missing date", amount: 25 },
        { transactionDate: "2025-03-02", narration: "Zero", amount: 0 },
      ],
    }), "statement.json");
    expect(rows).toEqual([{
      date: "2025-03-01",
      details: "Refund",
      amount: 50,
      kind: "income",
      reference: "",
      balance: undefined,
    }]);
  });

  it("surfaces malformed JSON rather than silently dropping the import", () => {
    expect(() => parseStatementText("{broken", "transactions.json")).toThrow();
  });
});

describe("voice expense parsing", () => {
  it.each([
    ["Add expense of ₹1,250 for dinner", "Food & dining", 1250],
    ["I spent 1,20,000 on groceries", "Groceries", 120000],
    ["Record 2.5k for Uber", "Transport", 2500],
    ["Spent 900 on rent", "Housing", 900],
  ])("extracts amount and category from %s", (transcript, category, amount) => {
    expect(parseVoiceExpense(transcript)).toMatchObject({ category, amount });
  });

  it("returns null when the transcript has no valid amount", () => {
    expect(parseVoiceExpense("I bought groceries")).toBeNull();
    expect(parseVoiceExpense("Spent zero rupees")).toBeNull();
  });
});

describe("receipt text parsing", () => {
  it("extracts the merchant, total, and category", () => {
    expect(parseReceiptText("Fresh Market\nTomatoes 120\nGrand Total: ₹1,250.50")).toEqual({
      title: "Fresh Market",
      category: "Groceries",
      amount: 1250.5,
      date: "Just now",
    });
  });

  it("returns null without a recognizable positive total", () => {
    expect(parseReceiptText("Receipt\nTax invoice\nNo amount")).toBeNull();
  });
});
