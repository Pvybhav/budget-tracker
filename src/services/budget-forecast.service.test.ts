import assert from "node:assert/strict";
import test from "node:test";

import { calculateDailySpendingPace } from "./budget-forecast.service.ts";

test("calculateDailySpendingPace uses the selected period window instead of always using today", () => {
  const RealDate = Date;
  const fakeNow = new RealDate("2025-08-15T12:00:00Z");

  class FrozenDate extends RealDate {
    constructor(...args: any[]) {
      super(...((args.length > 0 ? args : [fakeNow]) as [number | string | Date]));
    }

    static now() {
      return fakeNow.getTime();
    }
  }

  const originalDate = globalThis.Date;
  globalThis.Date = FrozenDate as DateConstructor;

  try {
    const pace = calculateDailySpendingPace(1000, 2025, 0, "monthly");

    assert.equal(pace.daysElapsed, 31);
    assert.equal(pace.daysRemaining, 0);
  } finally {
    globalThis.Date = originalDate;
  }
});
