import { describe, expect, it } from "vitest";
import { dateOnly, getStatementDateRange } from "./date";

describe("dateOnly", () => {
  it("uses the local calendar day for timestamps", () => {
    const timestamp = new Date(2026, 2, 1, 0, 0).toISOString();
    const localDate = new Date(timestamp);
    const expected = [
      localDate.getFullYear(),
      String(localDate.getMonth() + 1).padStart(2, "0"),
      String(localDate.getDate()).padStart(2, "0"),
    ].join("-");

    expect(dateOnly(timestamp)).toBe(expected);
  });

  it("keeps date-only values timezone-independent", () => {
    expect(dateOnly("2026-03-01")).toBe("2026-03-01");
    expect(dateOnly("2026-03-01T00:00:00.000Z")).toBe("2026-03-01");
  });

  it("calculates a card statement period from the previous close through the selected close", () => {
    expect(getStatementDateRange(15, 2026, 3)).toEqual({
      start: "2026-02-16",
      end: "2026-03-15",
    });
    expect(getStatementDateRange(31, 2026, 3)).toEqual({
      start: "2026-03-01",
      end: "2026-03-31",
    });
    expect(getStatementDateRange(0, 2026, 3)).toBeUndefined();
  });
});
