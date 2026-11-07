import { useMemo, useState } from "react";
import { FileUp, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import type {
  Category,
  Expense,
  Income,
  IncomeCategory,
  Investment,
  InvestmentTransactionType,
} from "../db/db";
import { useBackendResource } from "../services/backendHooks";
import {
  fetchCards,
  fetchCategories,
  fetchExpenses,
  fetchIncomes,
  fetchInvestments,
} from "../services/backend.service";
import { createExpense, createIncome, createInvestmentTransaction } from "../services/backendSync";
import { showAlert } from "../components/Confirm";
import { formatMoney, useDisplayCurrency } from "../services/currency.service";
import { dateOnly, dateTimeInput, dateTimeInputToUTC } from "../utils/date";

interface ImportRow {
  dateTime: string;
  details: string;
  amount: number;
  kind: "expense" | "income" | "investment";
  categoryId: string;
  incomeCategory: IncomeCategory;
  investmentId: string;
  investmentTransactionType: InvestmentTransactionType;
  quantity: number | undefined;
  selected: boolean;
}

const INCOME_CATEGORIES: { value: IncomeCategory; label: string }[] = [
  { value: "salary", label: "Salary" },
  { value: "freelance", label: "Freelance" },
  { value: "business", label: "Business" },
  { value: "interest", label: "Interest" },
  { value: "dividend", label: "Dividend" },
  { value: "refund", label: "Refund" },
  { value: "gift", label: "Gift" },
  { value: "other", label: "Other" },
];

function parseDateTime(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : dateTimeInput(value.toISOString());
  }
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return "";
    return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}T${String(date.H ?? 0).padStart(2, "0")}:${String(date.M ?? 0).padStart(2, "0")}`;
  }

  const text = String(value ?? "").trim();
  if (!text) return "";
  const isoDate = text.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}:\d{2}(?::\d{2})?))?/);
  if (isoDate) {
    const time = isoDate[2] ? isoDate[2].slice(0, 5) : "12:00";
    return `${isoDate[1]}T${time}`;
  }
  const localDate = text.match(
    /^(\d{1,2})[/. -](\d{1,2})[/. -](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?)?$/,
  );
  if (localDate) {
    const [, day, month, rawYear, hour = "12", minute = "00"] = localDate;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : dateTimeInput(parsed.toISOString());
}

function parseAmount(value: unknown) {
  const amount = Number.parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

function isValidDateTime(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const parsed = new Date(year, month - 1, day, hour, minute);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day &&
    parsed.getHours() === hour &&
    parsed.getMinutes() === minute
  );
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parseRows(file: File): Promise<ImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: "array", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
        if (!sheet) {
          resolve([]);
          return;
        }
        const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          defval: "",
          blankrows: false,
        });
        const headerRowIndex = sheetRows.findIndex((row) => {
          const headers = row.map(normalizeHeader);
          const hasDate = headers.some((header) => header.includes("date"));
          const hasAmount = headers.some(
            (header) =>
              header.includes("debit") ||
              header.includes("withdrawal") ||
              header.includes("credit") ||
              header.includes("deposit") ||
              (header.includes("amount") &&
                !header.includes("openingbalance") &&
                !header.includes("closingbalance")) ||
              header === "value",
          );
          return hasDate && hasAmount;
        });
        if (headerRowIndex < 0) {
          resolve([]);
          return;
        }

        const headers = sheetRows[headerRowIndex].map(normalizeHeader);
        const findIndex = (patterns: string[]) =>
          headers.findIndex((header) => patterns.some((pattern) => header.includes(pattern)));
        const dateIndex = findIndex(["date"]);
        const debitIndex = findIndex(["debit", "withdrawal"]);
        const creditIndex = findIndex(["credit", "deposit"]);
        const amountIndex = headers.findIndex(
          (header) =>
            (header.includes("amount") &&
              !header.includes("openingbalance") &&
              !header.includes("closingbalance")) ||
            header === "value",
        );
        const detailsIndex = findIndex([
          "narration",
          "description",
          "particular",
          "details",
          "remarks",
          "memo",
        ]);
        const quantityIndex = findIndex(["quantity", "units", "unit"]);

        const result: ImportRow[] = [];
        for (const cells of sheetRows.slice(headerRowIndex + 1)) {
          const debit = debitIndex < 0 ? 0 : parseAmount(cells[debitIndex]);
          const credit = creditIndex < 0 ? 0 : parseAmount(cells[creditIndex]);
          const amount =
            debit > 0
              ? debit
              : credit > 0
                ? credit
                : debitIndex >= 0 || creditIndex >= 0 || amountIndex < 0
                  ? 0
                  : parseAmount(cells[amountIndex]);
          const dateTime = parseDateTime(cells[dateIndex]);
          if (!isValidDateTime(dateTime) || amount <= 0) continue;

          result.push({
            dateTime,
            details: detailsIndex < 0 ? "" : String(cells[detailsIndex] ?? "").trim(),
            amount,
            kind: credit > 0 && debit === 0 ? "income" : "expense",
            categoryId: "",
            incomeCategory: "other",
            investmentId: "",
            investmentTransactionType: "buy",
            quantity:
              quantityIndex < 0 || !String(cells[quantityIndex] ?? "").trim()
                ? undefined
                : parseAmount(cells[quantityIndex]),
            selected: true,
          });
        }
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function rowKey(row: ImportRow) {
  return `${dateOnly(row.dateTime)}|${row.kind}|${row.amount}|${row.details.trim().toLowerCase()}`;
}

export default function ImportPage() {
  const displayCurrency = useDisplayCurrency();
  const cards = useBackendResource(() => fetchCards(), []);
  const categories = useBackendResource(() => fetchCategories(), []);
  const expenses = useBackendResource(() => fetchExpenses(), []);
  const incomes = useBackendResource(() => fetchIncomes(), []);
  const investments = useBackendResource(() => fetchInvestments(), []);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [cardId, setCardId] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState("");

  const duplicateIndexes = useMemo(() => {
    const knownKeys = new Set([
      ...(expenses ?? []).map((expense) =>
        rowKey({
          dateTime: expense.date,
          kind: "expense",
          amount: expense.amount,
          details: expense.details ?? "",
          categoryId: "",
          incomeCategory: "other",
          investmentId: "",
          investmentTransactionType: "buy",
          quantity: undefined,
          selected: true,
        }),
      ),
      ...(incomes ?? []).map((income) =>
        rowKey({
          dateTime: income.date,
          kind: "income",
          amount: income.amount,
          details: income.source,
          categoryId: "",
          incomeCategory: "other",
          investmentId: "",
          investmentTransactionType: "buy",
          quantity: undefined,
          selected: true,
        }),
      ),
    ]);
    const duplicates = new Set<number>();
    rows.forEach((row, index) => {
      const key = rowKey(row);
      if (knownKeys.has(key)) duplicates.add(index);
      knownKeys.add(key);
    });
    return duplicates;
  }, [expenses, incomes, rows]);

  const updateRow = (index: number, patch: Partial<ImportRow>) => {
    setRows((currentRows) =>
      currentRows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  };

  const selectedRows = rows.filter((row) => row.selected);
  const selectedPendingRows = rows.filter(
    (row, index) => row.selected && !duplicateIndexes.has(index),
  );
  const setAllRowsSelected = (selected: boolean) => {
    setRows((currentRows) => currentRows.map((row) => ({ ...row, selected })));
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsedRows = await parseRows(file);
      setRows(parsedRows);
      setIsReviewing(false);
      setMessage(
        parsedRows.length
          ? ""
          : "No transactions found. Make sure the statement has a date column and debit, credit, or amount column.",
      );
    } catch (error) {
      setRows([]);
      setIsReviewing(false);
      setMessage(
        error instanceof Error
          ? `Could not read this file: ${error.message}`
          : "Could not read this file. Use a CSV or Excel statement with transaction columns.",
      );
    }
  };

  const reviewImport = async () => {
    if (!cardId) {
      await showAlert("Select the account for these transactions");
      return;
    }
    if (!selectedRows.length) {
      await showAlert("Select at least one transaction to import");
      return;
    }
    const missingCategory = selectedPendingRows.some(
      (row) => row.kind === "expense" && !row.categoryId,
    );
    if (missingCategory) {
      await showAlert("Choose an expense category for every selected debit before reviewing");
      return;
    }
    const missingInvestment = selectedPendingRows.some(
      (row) => row.kind === "investment" && !row.investmentId,
    );
    if (missingInvestment) {
      await showAlert("Choose an existing investment for every selected investment transaction");
      return;
    }
    const invalidRow = selectedPendingRows.some(
      (row) =>
        !row.details.trim() ||
        !Number.isFinite(row.amount) ||
        row.amount <= 0 ||
        !isValidDateTime(row.dateTime),
    );
    if (invalidRow) {
      await showAlert(
        "Check that every transaction has a description, valid date and time, and amount greater than zero",
      );
      return;
    }
    if (!selectedPendingRows.length) {
      await showAlert("There are no new selected rows to import");
      return;
    }
    setIsReviewing(true);
  };

  const importRows = async () => {
    const pending = rows.filter((row, index) => row.selected && !duplicateIndexes.has(index));
    if (!pending.length) {
      await showAlert("There are no new rows to import");
      return;
    }
    setIsImporting(true);
    const importedIndexes = new Set<number>();
    try {
      for (const [index, row] of rows.entries()) {
        if (!row.selected || duplicateIndexes.has(index)) continue;
        const date = dateTimeInputToUTC(row.dateTime);
        if (row.kind === "investment") {
          await createInvestmentTransaction({
            investmentId: row.investmentId,
            type: row.investmentTransactionType,
            quantity: row.quantity,
            amount: row.amount,
            date,
            note: row.details.trim() || undefined,
          });
        } else if (row.kind === "income") {
          const payload: Omit<Income, "id"> = {
            source: row.details.trim(),
            category: row.incomeCategory,
            accountId: cardId,
            amount: row.amount,
            date,
          };
          await createIncome(payload);
        } else {
          const payload: Omit<Expense, "id"> = {
            cardId,
            categoryId: row.categoryId,
            details: row.details.trim(),
            amount: row.amount,
            date,
            reconciled: false,
          };
          await createExpense(payload);
        }
        importedIndexes.add(index);
      }
      setRows([]);
      setIsReviewing(false);
      setMessage(
        `Imported ${pending.length} transaction${pending.length === 1 ? "" : "s"}. Duplicate rows were skipped.`,
      );
    } catch (error) {
      setRows((currentRows) => currentRows.filter((_, index) => !importedIndexes.has(index)));
      setIsReviewing(false);
      await showAlert(
        `${importedIndexes.size ? `${importedIndexes.size} transaction(s) were saved. ` : ""}Import failed: ${
          error instanceof Error ? error.message : "Unable to save transactions."
        }`,
      );
    } finally {
      setIsImporting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          Import Transactions
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Upload a CSV or Excel statement, categorize each transaction, review, then save.
        </p>
      </div>

      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-600 hover:border-emerald-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
          <FileUp className="h-8 w-8 text-emerald-500 dark:text-emerald-400" />
          <span>Select CSV or Excel statement</span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFile}
            className="sr-only"
            aria-label="Select CSV or Excel statement"
          />
        </label>
        <label className="block text-sm text-slate-600 dark:text-slate-400">
          Account
          <select
            aria-label="Account"
            value={cardId}
            onChange={(event) => setCardId(event.target.value)}
            className={`${inputClass} mt-1`}
          >
            <option value="">Select account</option>
            {cards?.map((card) => (
              <option key={card.id} value={card.id}>
                {card.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {message && (
        <p
          role="status"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300"
        >
          {message}
        </p>
      )}

      {rows.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                {isReviewing ? "Review before saving" : "Edit imported transactions"}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {rows.length} transactions: {rows.filter((row) => row.kind === "expense").length}{" "}
                debits, {rows.filter((row) => row.kind === "income").length} credits,{" "}
                {rows.filter((row) => row.kind === "investment").length} investments.{" "}
                {selectedRows.length} selected; {duplicateIndexes.size} duplicate
                {duplicateIndexes.size === 1 ? "" : "s"} will be skipped.
              </p>
            </div>
            {isReviewing ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsReviewing(false)}
                  disabled={isImporting}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  Back to edit
                </button>
                <button
                  type="button"
                  onClick={importRows}
                  disabled={isImporting}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {isImporting ? "Saving..." : `Save ${selectedPendingRows.length} transactions`}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAllRowsSelected(true)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setAllRowsSelected(false)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={reviewImport}
                  className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white"
                >
                  Review import
                </button>
              </div>
            )}
          </div>

          <div className="max-h-[34rem] overflow-auto">
            <table className="w-full min-w-[1200px] text-left text-sm text-slate-700 dark:text-slate-300">
              <thead className="sticky top-0 border-b border-slate-300 bg-slate-200 dark:border-slate-800 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-3 text-slate-900 dark:text-slate-100">
                    <input
                      type="checkbox"
                      aria-label="Select all transactions"
                      checked={rows.length > 0 && rows.every((row) => row.selected)}
                      onChange={(event) => setAllRowsSelected(event.target.checked)}
                      disabled={isReviewing}
                    />
                  </th>
                  <th className="px-3 py-3 text-slate-900 dark:text-slate-100">Date &amp; time</th>
                  <th className="px-3 py-3 text-slate-900 dark:text-slate-100">Description</th>
                  <th className="px-3 py-3 text-slate-900 dark:text-slate-100">Type</th>
                  <th className="px-3 py-3 text-slate-900 dark:text-slate-100">
                    Category / investment
                  </th>
                  <th className="px-3 py-3 text-slate-900 dark:text-slate-100">
                    Investment transaction
                  </th>
                  <th className="px-3 py-3 text-slate-900 dark:text-slate-100">Units</th>
                  <th className="px-3 py-3 text-slate-900 dark:text-slate-100">Amount</th>
                  <th className="px-3 py-3 text-slate-900 dark:text-slate-100">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {rows.map((row, index) => {
                  const duplicate = duplicateIndexes.has(index);
                  return (
                    <tr
                      key={`${row.dateTime}-${index}`}
                      className={`${duplicate ? "opacity-60" : ""} ${row.selected ? "" : "opacity-50"}`}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select transaction ${index + 1}`}
                          checked={row.selected}
                          onChange={(event) => updateRow(index, { selected: event.target.checked })}
                          disabled={isReviewing || duplicate}
                        />
                      </td>
                      <td className="px-3 py-3">
                        {isReviewing ? (
                          <span>{row.dateTime.replace("T", " ")}</span>
                        ) : (
                          <input
                            type="datetime-local"
                            aria-label={`Date and time for transaction ${index + 1}`}
                            value={row.dateTime}
                            onChange={(event) => updateRow(index, { dateTime: event.target.value })}
                            className={inputClass}
                          />
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {isReviewing ? (
                          row.details
                        ) : (
                          <input
                            type="text"
                            aria-label={`Description for transaction ${index + 1}`}
                            value={row.details}
                            onChange={(event) => updateRow(index, { details: event.target.value })}
                            className={inputClass}
                          />
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {isReviewing ? (
                          <span className="capitalize">{row.kind}</span>
                        ) : (
                          <select
                            aria-label={`Type for transaction ${index + 1}`}
                            value={row.kind}
                            onChange={(event) =>
                              updateRow(index, {
                                kind: event.target.value as ImportRow["kind"],
                                categoryId: "",
                                investmentId: "",
                              })
                            }
                            className={inputClass}
                          >
                            <option value="expense">Expense</option>
                            <option value="income">Income</option>
                            <option value="investment">Investment</option>
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {row.kind === "investment" ? (
                          isReviewing ? (
                            (investments?.find((investment) => investment.id === row.investmentId)
                              ?.name ?? "Investment unavailable")
                          ) : (
                            <select
                              aria-label={`Investment for transaction ${index + 1}`}
                              value={row.investmentId}
                              onChange={(event) =>
                                updateRow(index, { investmentId: event.target.value })
                              }
                              className={inputClass}
                            >
                              <option value="">Select existing investment</option>
                              {investments?.map((investment: Investment) => (
                                <option key={investment.id} value={investment.id}>
                                  {investment.name} ({investment.type})
                                </option>
                              ))}
                            </select>
                          )
                        ) : isReviewing ? (
                          row.kind === "expense" ? (
                            (categories?.find((category) => category.id === row.categoryId)
                              ?.title ?? "Uncategorized")
                          ) : (
                            (INCOME_CATEGORIES.find(
                              (category) => category.value === row.incomeCategory,
                            )?.label ?? "Other")
                          )
                        ) : row.kind === "expense" ? (
                          <select
                            aria-label={`Category for expense ${index + 1}`}
                            value={row.categoryId}
                            onChange={(event) =>
                              updateRow(index, { categoryId: event.target.value })
                            }
                            className={inputClass}
                          >
                            <option value="">Select category</option>
                            {categories?.map((category: Category) => (
                              <option key={category.id} value={category.id}>
                                {category.title}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            aria-label={`Category for income ${index + 1}`}
                            value={row.incomeCategory}
                            onChange={(event) =>
                              updateRow(index, {
                                incomeCategory: event.target.value as IncomeCategory,
                              })
                            }
                            className={inputClass}
                          >
                            {INCOME_CATEGORIES.map((category) => (
                              <option key={category.value} value={category.value}>
                                {category.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {row.kind === "investment" ? (
                          isReviewing ? (
                            <span className="capitalize">{row.investmentTransactionType}</span>
                          ) : (
                            <select
                              aria-label={`Investment transaction type for row ${index + 1}`}
                              value={row.investmentTransactionType}
                              onChange={(event) =>
                                updateRow(index, {
                                  investmentTransactionType: event.target
                                    .value as InvestmentTransactionType,
                                })
                              }
                              className={inputClass}
                            >
                              <option value="buy">Buy</option>
                              <option value="sell">Sell</option>
                              <option value="dividend">Dividend</option>
                              <option value="fee">Fee</option>
                            </select>
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {row.kind === "investment" ? (
                          isReviewing ? (
                            (row.quantity ?? "—")
                          ) : (
                            <input
                              type="number"
                              min="0"
                              step="0.0001"
                              aria-label={`Units for investment row ${index + 1}`}
                              value={row.quantity ?? ""}
                              onChange={(event) =>
                                updateRow(index, {
                                  quantity: event.target.value
                                    ? Number.parseFloat(event.target.value)
                                    : undefined,
                                })
                              }
                              className={inputClass}
                            />
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {isReviewing ? (
                          formatMoney(row.amount, displayCurrency)
                        ) : (
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            aria-label={`Amount for transaction ${index + 1}`}
                            value={row.amount}
                            onChange={(event) =>
                              updateRow(index, { amount: Number.parseFloat(event.target.value) })
                            }
                            className={inputClass}
                          />
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {duplicate
                          ? "Duplicate - skipped"
                          : !row.selected
                            ? "Not selected"
                            : "Ready"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
