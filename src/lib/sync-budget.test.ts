import { describe, it, expect } from "vitest";
import { evaluateSyncTiming, CRON_MAX_DURATION_MS, SYNC_BUDGET_MS } from "@/lib/sync-budget";
import { ownerSlowSyncAlert } from "@/lib/emails";

describe("evaluateSyncTiming", () => {
  it("leaves headroom between the warning budget and Vercel's hard cap", () => {
    // The whole point is warning early; a budget at or above the cap warns too late.
    expect(SYNC_BUDGET_MS).toBeLessThan(CRON_MAX_DURATION_MS);
  });

  it("does not warn on a fast run", () => {
    const t = evaluateSyncTiming(3_000, 45_000);
    expect(t.overBudget).toBe(false);
    expect(t.percentOfCap).toBe(5);
  });

  it("warns once the run passes the budget but still finishes", () => {
    const t = evaluateSyncTiming(47_500, 45_000);
    expect(t.overBudget).toBe(true);
    expect(t.elapsedMs).toBe(47_500);
    expect(t.percentOfCap).toBe(79);
  });

  it("treats exactly the budget as still inside it", () => {
    expect(evaluateSyncTiming(45_000, 45_000).overBudget).toBe(false);
  });

  it("rounds fractional milliseconds from performance.now()", () => {
    expect(evaluateSyncTiming(1234.6, 45_000).elapsedMs).toBe(1235);
  });
});

describe("ownerSlowSyncAlert", () => {
  it("reports the duration and the cap in seconds", () => {
    const mail = ownerSlowSyncAlert({
      ...evaluateSyncTiming(47_500, 45_000),
      fetched: 312,
    });
    expect(mail.subject).toBe("BillWatch sync is slow: 47.5s of a 60.0s limit");
    expect(mail.text).toContain("312 bills");
    expect(mail.text).toContain("79%");
    expect(mail.html).toContain("<p>");
  });
});
