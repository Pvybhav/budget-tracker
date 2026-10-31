import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  convertCurrency,
  formatConverted,
  formatMoney,
  getCurrencyOption,
  getCurrencySymbol,
  getDisplayCurrency,
  onDisplayCurrencyChange,
  setDisplayCurrency,
  SUPPORTED_CURRENCIES,
  useDisplayCurrency,
} from "./currency.service";

afterEach(() => {
  setDisplayCurrency("INR");
  window.localStorage.clear();
});

describe("currency helpers", () => {
  it("supports default, known, and unknown currency labels", () => {
    expect(getCurrencyOption()).toMatchObject({ code: "INR", symbol: "₹" });
    expect(getCurrencyOption("usd")).toMatchObject({ code: "USD", name: "US Dollar" });
    expect(getCurrencyOption("abc")).toMatchObject({ code: "ABC", symbol: "ABC" });
    expect(getCurrencySymbol("EUR")).toBe("€");
    expect(SUPPORTED_CURRENCIES.length).toBeGreaterThan(1);
  });

  it("converts through USD, defaults missing codes, and falls back for unknown codes", () => {
    expect(convertCurrency(83.5, "INR", "USD")).toBeCloseTo(1);
    expect(convertCurrency(1, "USD", "EUR")).toBeCloseTo(0.92);
    expect(convertCurrency(10)).toBe(10);
    expect(convertCurrency(10, "???", "???")).toBe(10);
    expect(convertCurrency(10, "???", "USD")).toBe(10);
  });

  it("formats supported, converted, and invalid currency values safely", () => {
    expect(formatMoney(1234.5, "INR")).toContain("₹");
    expect(formatConverted(1, "USD", "EUR")).toContain("€");
    expect(formatMoney(10.5, "BAD")).toContain("BAD");
  });
});

describe("display currency state", () => {
  it("persists normalized selections and notifies active listeners", () => {
    const observed: string[] = [];
    const unsubscribe = onDisplayCurrencyChange((code) => observed.push(code));

    setDisplayCurrency("usd");

    expect(getDisplayCurrency()).toBe("USD");
    expect(window.localStorage.getItem("budget-tracker:display-currency")).toBe("USD");
    expect(observed).toEqual(["USD"]);
    unsubscribe();
  });

  it("updates React subscribers when the display currency changes", () => {
    const { result } = renderHook(() => useDisplayCurrency());

    act(() => setDisplayCurrency("EUR"));

    expect(result.current).toBe("EUR");
  });
});
