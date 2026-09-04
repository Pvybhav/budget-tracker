import { useEffect, useState } from "react";

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
}

// Static offline table - no external FX API/key is wired up in this project. Rates are
// "units of currency per 1 USD" so any pair can be converted via USD as the common pivot.
// Update this table manually if more accurate/live rates are ever needed.
export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
];

const USD_RATES: Record<string, number> = {
  USD: 1,
  INR: 83.5,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  AUD: 1.52,
  CAD: 1.36,
  SGD: 1.34,
  AED: 3.67,
  CNY: 7.24,
};

const DISPLAY_CURRENCY_KEY = "budget-tracker:display-currency";
const DEFAULT_CURRENCY = "INR";

export function getCurrencyOption(code?: string | null): CurrencyOption {
  const normalized = (code || DEFAULT_CURRENCY).toUpperCase();
  return (
    SUPPORTED_CURRENCIES.find((c) => c.code === normalized) ?? {
      code: normalized,
      name: normalized,
      symbol: normalized,
    }
  );
}

export function getCurrencySymbol(code?: string | null): string {
  return getCurrencyOption(code).symbol;
}

// Converts amount from one currency to another using USD as the pivot. Falls back to a 1:1
// rate for unrecognized codes rather than throwing, since money fields are optional/free-form.
export function convertCurrency(amount: number, from?: string | null, to?: string | null): number {
  const fromCode = (from || DEFAULT_CURRENCY).toUpperCase();
  const toCode = (to || DEFAULT_CURRENCY).toUpperCase();
  if (fromCode === toCode) return amount;
  const fromRate = USD_RATES[fromCode] ?? 1;
  const toRate = USD_RATES[toCode] ?? 1;
  const usdAmount = amount / fromRate;
  return usdAmount * toRate;
}

export function formatMoney(amount: number, currency?: string | null): string {
  const code = (currency || DEFAULT_CURRENCY).toUpperCase();
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Intl throws on codes it doesn't recognize (e.g. a stray 3-letter typo) - fall back to
    // a plain symbol-prefixed number so rendering never crashes on bad/legacy data.
    return `${getCurrencySymbol(code)}${amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

// Converts `amount` from its own currency into the current display currency, then formats it.
export function formatConverted(amount: number, fromCurrency: string | undefined, displayCurrency: string) {
  return formatMoney(convertCurrency(amount, fromCurrency, displayCurrency), displayCurrency);
}

type Listener = (currency: string) => void;
const listeners = new Set<Listener>();

function readStoredDisplayCurrency(): string {
  if (typeof window === "undefined") return DEFAULT_CURRENCY;
  return window.localStorage.getItem(DISPLAY_CURRENCY_KEY) || DEFAULT_CURRENCY;
}

let currentDisplayCurrency = readStoredDisplayCurrency();

export function getDisplayCurrency(): string {
  return currentDisplayCurrency;
}

export function setDisplayCurrency(code: string) {
  const normalized = code.toUpperCase();
  currentDisplayCurrency = normalized;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(DISPLAY_CURRENCY_KEY, normalized);
  }
  listeners.forEach((listener) => listener(normalized));
}

export function onDisplayCurrencyChange(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// React hook: re-renders the component whenever the app-wide display currency changes.
export function useDisplayCurrency(): string {
  const [currency, setCurrency] = useState(getDisplayCurrency);
  useEffect(() => onDisplayCurrencyChange(setCurrency), []);
  return currency;
}
