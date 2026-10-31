import * as XLSX from "xlsx";

export type ImportedStatementRow = {
  date: string;
  details: string;
  amount: number;
  kind: "expense" | "income";
  reference?: string;
  balance?: number;
};

export type ExpenseDraft = {
  title: string;
  category: string;
  amount: number;
  date: string;
};

function statementValue(row: Record<string, unknown>, names: string[]) {
  const entry = Object.entries(row).find(([key]) =>
    names.some((name) => {
      const normalizedKey = key.toLowerCase().replace(/[\s_-]/g, "");
      return name.length <= 2 ? normalizedKey === name : normalizedKey.includes(name);
    }),
  );
  return entry?.[1];
}

function statementAmount(value: unknown) {
  const normalized = String(value ?? "").replace(/[^0-9.-]/g, "");
  if (!normalized) return 0;
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

function splitStatementLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function statementDate(value: unknown) {
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const text = String(value ?? "").trim();
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(text)) {
    const [year, month, day] = text.split(/[-/]/);
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const slashDate = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashDate) {
    const first = Number(slashDate[1]);
    const second = Number(slashDate[2]);
    const year = Number(slashDate[3].length === 2 ? `20${slashDate[3]}` : slashDate[3]);
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

export function parseStatementText(text: string, fileName = ""): ImportedStatementRow[] {
  let rows: Record<string, unknown>[] = [];
  if (fileName.toLowerCase().endsWith(".json") || text.trimStart().startsWith("[")) {
    const parsed = JSON.parse(text) as unknown;
    const records = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { transactions?: unknown[] }).transactions)
        ? (parsed as { transactions: unknown[] }).transactions
        : [];
    rows = records.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
  } else {
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    const sample = lines[0] ?? "";
    const tabCount = sample.match(/\t/g)?.length ?? 0;
    const semicolonCount = sample.match(/;/g)?.length ?? 0;
    const commaCount = sample.match(/,/g)?.length ?? 0;
    const delimiter = tabCount >= Math.max(semicolonCount, commaCount)
      ? "\t"
      : semicolonCount > commaCount
        ? ";"
        : ",";
    const headers = splitStatementLine(lines.shift() ?? "", delimiter).map((cell) => cell.replace(/^"|"$/g, ""));
    rows = lines.map((line) => {
      const cells = splitStatementLine(line, delimiter).map((cell) => cell.replace(/^"|"$/g, ""));
      return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    });
  }
  return rows.map((row) => {
    const debit = statementAmount(statementValue(row, ["debit", "withdrawal", "dr", "paid", "spent"]));
    const credit = statementAmount(statementValue(row, ["credit", "deposit", "cr", "received", "refunded"]));
    const generic = statementAmount(statementValue(row, ["amount", "transactionvalue", "value"]));
    const rawAmount = debit || credit || generic;
    const signed = Number(String(statementValue(row, ["amount", "transactionvalue", "value"]) ?? "").replace(/,/g, ""));
    return {
      date: statementDate(statementValue(row, ["date", "transactiondate", "valuedate", "postingdate"])),
      details: String(statementValue(row, ["description", "details", "narration", "particular", "merchant", "remarks"]) ?? "Imported transaction").trim(),
      amount: rawAmount,
      kind: credit > 0 || (!debit && signed < 0) ? "income" as const : "expense" as const,
      reference: String(statementValue(row, ["reference", "refno", "transactionid", "cheque"]) ?? "").trim(),
      balance: statementAmount(statementValue(row, ["balance", "closingbalance", "availablebalance"])) || undefined,
    };
  }).filter((row) => row.date && row.amount > 0);
}

export function parseVoiceExpense(transcript: string): ExpenseDraft | null {
  const normalized = transcript.trim().replace(/(\d),(?=\d{2,3}(?:,|(?:\.\d{1,2})?\b))/g, "$1").replace(/\s+/g, " ");
  const amountMatch = normalized.match(/(?:₹|rs\.?|rupees?|inr)?\s*(\d+(?:\.\d{1,2})?)(?:\s*(?:k|thousand))?/i);
  if (!amountMatch) return null;
  const amount = Number(amountMatch[1]) * (/k|thousand/i.test(amountMatch[0]) ? 1000 : 1);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const category = /food|dinner|lunch|breakfast|coffee|restaurant|grocer/i.test(normalized)
    ? (/grocer/i.test(normalized) ? "Groceries" : "Food & dining")
    : /rent|home|house|electricity/i.test(normalized)
      ? "Housing"
      : /uber|ola|taxi|fuel|bus|train|transport/i.test(normalized)
        ? "Transport"
        : "Other";
  const title = normalized
    .replace(/^(?:please\s+)?(?:add|record|log)\s+(?:an?\s+)?(?:expense|spending)\s*(?:of)?/i, "")
    .replace(/^(?:please\s+)?(?:add|record|log)\s+/i, "")
    .replace(/^(?:i\s+)?spent\s*/i, "")
    .replace(/(?:₹|rs\.?|rupees?|inr)?\s*\d+(?:\.\d{1,2})?\s*(?:k|thousand)?/i, "")
    .replace(/^\s*(?:on|for|at)\s+/i, "")
    .trim();
  return { title: title || category, category, amount, date: "Just now" };
}

export function parseReceiptText(text: string): ExpenseDraft | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const amountMatches = [...text.replace(/,/g, "").matchAll(/(?:total|amount|grand total|net)\D{0,15}(\d+(?:\.\d{1,2})?)/gi)];
  const fallbackMatches = [...text.replace(/,/g, "").matchAll(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d{1,2})?)/gi)];
  const amount = Number((amountMatches.at(-1) ?? fallbackMatches.at(-1))?.[1] ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const title = lines.find((line) => !/receipt|invoice|tax|gst|total|amount|date|bill/i.test(line) && !/\d{3,}/.test(line)) ?? "Receipt purchase";
  const category = /grocer|market|super/i.test(text) ? "Groceries" : /restaurant|cafe|food|dining/i.test(text) ? "Food & dining" : /fuel|petrol|uber|taxi/i.test(text) ? "Transport" : "Other";
  return { title: title.slice(0, 60), category, amount, date: "Just now" };
}
