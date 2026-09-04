import { useMemo, useState } from "react";
import { FileUp, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import type { Card, Category, Expense, Income } from "../db/db";
import { useBackendResource } from "../services/backendHooks";
import { fetchCards, fetchCategories, fetchExpenses } from "../services/backend.service";
import { createExpense, createIncome } from "../services/backendSync";
import { showAlert } from "../components/Confirm";
import { formatMoney, useDisplayCurrency } from "../services/currency.service";
interface ImportRow {
  date: string;
  details: string;
  amount: number;
  kind: "expense" | "income";
}
function parseDate(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    return date
      ? `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`
      : "";
  }
  const text = String(value ?? "").trim();
  if (!text) return "";
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString().slice(0, 10);
}
function parseAmount(value: unknown) {
  const amount = Number.parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}
function parseRows(file: File): Promise<ImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: "array", cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        const result = rows
          .map((row) => {
            const values = Object.entries(row);
            const find = (names: string[]) =>
              values.find(([key]) => names.some((name) => key.toLowerCase().includes(name)))?.[1];
            const debit = parseAmount(find(["debit", "withdrawal"]));
            const credit = parseAmount(find(["credit", "deposit"]));
            const genericAmount = parseAmount(find(["amount", "value"]));
            const amount = debit || credit || genericAmount;
            return {
              date: parseDate(find(["date", "transaction"])),
              details: String(find(["description", "details", "narration", "particular"]) ?? ""),
              amount,
              kind: (credit > 0 && debit === 0 ? "income" : "expense") as "income" | "expense",
            };
          })
          .filter(
            (row) =>
              /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
              !Number.isNaN(new Date(`${row.date}T00:00:00`).getTime()) &&
              row.amount > 0,
          );
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}
export default function ImportPage() {
  const displayCurrency = useDisplayCurrency();
  const cards = useBackendResource(() => fetchCards(), []);
  const categories = useBackendResource(() => fetchCategories(), []);
  const expenses = useBackendResource(() => fetchExpenses(), []);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [cardId, setCardId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState("");
  const duplicateIndexes = useMemo(() => {
    const knownKeys = new Set(
      (expenses ?? []).map(
        (expense) =>
          `${expense.date.slice(0, 10)}|expense|${expense.amount}|${expense.details?.trim().toLowerCase() ?? ""}`,
      ),
    );
    const duplicates = new Set<number>();
    rows.forEach((row, index) => {
      const key = `${row.date}|${row.kind}|${row.amount}|${row.details.trim().toLowerCase()}`;
      if (knownKeys.has(key)) duplicates.add(index);
      knownKeys.add(key);
    });
    return duplicates;
  }, [expenses, rows]);
  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setRows(await parseRows(file));
      setMessage("");
    } catch {
      setMessage(
        "Could not read this file. Use a CSV or Excel file with date, description, and amount columns.",
      );
    }
  };
  const importRows = async () => {
    if (!cardId) {
      await showAlert("Select the account for these transactions");
      return;
    }
    const pending = rows.filter((_, index) => !duplicateIndexes.has(index));
    if (!pending.length) {
      await showAlert("There are no new rows to import");
      return;
    }
    setIsImporting(true);
    try {
      for (const row of pending) {
        if (row.kind === "income") {
          const payload: Omit<Income, "id"> = {
            source: row.details || "Imported income",
            category: "other",
            accountId: cardId,
            amount: row.amount,
            date: `${row.date}T12:00:00`,
          };
          await createIncome(payload);
        } else {
          const payload: Expense = {
            cardId,
            categoryId: categoryId || undefined,
            details: row.details || undefined,
            amount: row.amount,
            date: `${row.date}T12:00:00`,
            reconciled: false,
          };
          await createExpense(payload);
        }
      }
      setRows([]);
      setMessage(
        `Imported ${pending.length} transaction${pending.length === 1 ? "" : "s"}. Duplicate rows were skipped.`,
      );
    } finally {
      setIsImporting(false);
    }
  };
  return (
    <div className="space-y-6">
      {" "}
      <div>
        {" "}
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          {" "}
          Import Transactions{" "}
        </h1>{" "}
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {" "}
          Review a CSV or Excel statement before adding it to your expense ledger.{" "}
        </p>{" "}
      </div>{" "}
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
        {" "}
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-600 hover:border-emerald-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
          {" "}
          <FileUp className="h-8 w-8 text-emerald-500 dark:text-emerald-400" />{" "}
          <span>Select CSV or Excel file</span>{" "}
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFile}
            className="sr-only"
          />{" "}
        </label>{" "}
        <div className="space-y-4">
          {" "}
          <label className="block text-sm text-slate-600 dark:text-slate-400">
            {" "}
            Account{" "}
            <select
              value={cardId}
              onChange={(event) => setCardId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2 text-slate-900 dark:text-white"
            >
              {" "}
              <option value="">Select account</option>{" "}
              {cards?.map((card: Card) => (
                <option key={card.id} value={card.id}>
                  {" "}
                  {card.title}{" "}
                </option>
              ))}{" "}
            </select>{" "}
          </label>{" "}
          <label className="block text-sm text-slate-600 dark:text-slate-400">
            {" "}
            Category (optional){" "}
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-2 text-slate-900 dark:text-white"
            >
              {" "}
              <option value="">Uncategorized</option>{" "}
              {categories?.map((category: Category) => (
                <option key={category.id} value={category.id}>
                  {" "}
                  {category.title}{" "}
                </option>
              ))}{" "}
            </select>{" "}
          </label>{" "}
        </div>{" "}
      </div>{" "}
      {message && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          {" "}
          {message}{" "}
        </p>
      )}{" "}
      {rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          {" "}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 p-4">
            {" "}
            <div>
              {" "}
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Preview</h2>{" "}
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {" "}
                {rows.length} rows, {rows.filter((row) => row.kind === "income").length} credits,{" "}
                {duplicateIndexes.size} duplicates will be skipped.{" "}
              </p>{" "}
            </div>{" "}
            <button
              onClick={importRows}
              disabled={isImporting}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              {" "}
              <Upload className="h-4 w-4" /> {isImporting ? "Importing..." : "Import new rows"}{" "}
            </button>{" "}
          </div>{" "}
          <div className="max-h-[28rem] overflow-auto">
            {" "}
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
              {" "}
              <thead className="sticky top-0 bg-slate-200 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-800">
                {" "}
                <tr>
                  {" "}
                  <th className="px-4 py-3 text-slate-900 dark:text-slate-100">Date</th>{" "}
                  <th className="px-4 py-3 text-slate-900 dark:text-slate-100">Description</th>{" "}
                  <th className="px-4 py-3 text-slate-900 dark:text-slate-100">Type</th>{" "}
                  <th className="px-4 py-3 text-slate-900 dark:text-slate-100">Amount</th>{" "}
                  <th className="px-4 py-3 text-slate-900 dark:text-slate-100">Status</th>{" "}
                </tr>{" "}
              </thead>{" "}
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {" "}
                {rows.map((row, index) => (
                  <tr
                    key={`${row.date}-${index}`}
                    className={duplicateIndexes.has(index) ? "opacity-50" : ""}
                  >
                    {" "}
                    <td className="px-4 py-3">{row.date}</td>{" "}
                    <td className="px-4 py-3">{row.details || "-"}</td>{" "}
                    <td className="px-4 py-3 capitalize">{row.kind}</td>{" "}
                    <td className="px-4 py-3"> {formatMoney(row.amount, displayCurrency)} </td>{" "}
                    <td className="px-4 py-3">
                      {" "}
                      {duplicateIndexes.has(index) ? "Duplicate" : "Ready"}{" "}
                    </td>{" "}
                  </tr>
                ))}{" "}
              </tbody>{" "}
            </table>{" "}
          </div>{" "}
        </div>
      )}{" "}
    </div>
  );
}
