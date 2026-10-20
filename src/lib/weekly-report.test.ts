import { describe, expect, it } from "vitest";
import type { SyncRun } from "@/lib/health";
import { weeklyReport, type WeeklyStats } from "@/lib/weekly-report";

function run(day: number, overrides: Partial<SyncRun> = {}): SyncRun {
  return {
    startedAt: `2026-10-${String(day).padStart(2, "0")}T23:00:01Z`,
    durationMs: 20_000,
    syncMs: 18_000,
    ok: true,
    error: null,
    fetched: 187,
    inserted: 0,
    changed: 1,
    notificationsQueued: 3,
    emailsSent: 3,
    ...overrides,
  };
}

function stats(overrides: Partial<WeeklyStats> = {}): WeeklyStats {
  return {
    runs: [13, 14, 15, 16, 17, 18, 19].map((d) => run(d)),
    subscribers: { confirmed: 42, newConfirmed: 5, unconfirmed: 3 },
    subscriptions: 61,
    emails: { sent: 21, failed: 0 },
    ...overrides,
  };
}

describe("weeklyReport", () => {
  it("summarizes a normal week", () => {
    const { subject, text } = weeklyReport(stats());
    expect(subject).toBe("BillWatch weekly: all good, 42 subscribers");
    expect(text).toContain("Confirmed: 42 (+5 this week)");
    expect(text).toContain("Runs: 7 (0 failed)");
    expect(text).toContain("Average: 20.0s");
    expect(text).toContain("Bill changes detected: 7, new bills: 0");
    expect(text).toContain("Sent: 21, failed: 0");
  });

  it("calls out failed, slow and missing runs and failed emails", () => {
    const { subject, text } = weeklyReport(
      stats({
        runs: [
          run(13, { ok: false, error: "LEGISinfo returned 503" }),
          run(14, { durationMs: 50_000 }),
          run(15),
        ],
        emails: { sent: 10, failed: 2 },
      }),
    );
    expect(subject).toBe("BillWatch weekly: 4 issue(s) need a look");
    expect(text).toContain("4 of the last 7 days had no recorded sync run");
    expect(text).toContain("1 run(s) failed, latest: LEGISinfo returned 503");
    expect(text).toContain("1 run(s) over the 45.0s budget.");
    expect(text).toContain("2 notification email(s) failed.");
    expect(text).toContain("slowest: 50.0s on 2026-10-14T23:00:01Z");
  });

  it("counts two runs on one day as one day", () => {
    const runs = [13, 14, 15, 16, 17, 18, 19].flatMap((d) => [
      run(d),
      run(d, { startedAt: `2026-10-${d}T17:00:01Z` }),
    ]);
    expect(weeklyReport(stats({ runs })).subject).toMatch(/all good/);
  });
});
