import { describe, it, expect } from "vitest";
import { healthProblems, type HealthSnapshot, type SyncRun } from "@/lib/health";

const now = new Date("2026-09-29T01:17:00Z");

function run(overrides: Partial<SyncRun> = {}): SyncRun {
  return {
    startedAt: "2026-09-28T23:00:01Z",
    durationMs: 21_400,
    syncMs: 19_800,
    ok: true,
    error: null,
    fetched: 187,
    inserted: 0,
    changed: 2,
    notificationsQueued: 5,
    emailsSent: 5,
    ...overrides,
  };
}

function snapshot(overrides: Partial<HealthSnapshot> = {}): HealthSnapshot {
  return {
    lastSyncedAt: "2026-09-28T23:00:05Z",
    bills: 187,
    outbox: { failedRecently: 0, stuckPending: 0 },
    lastRun: run(),
    ...overrides,
  };
}

describe("healthProblems", () => {
  it("is empty when the nightly sync ran and email is flowing", () => {
    expect(healthProblems(snapshot(), now)).toEqual([]);
  });

  it("flags a sync older than the threshold", () => {
    const problems = healthProblems(snapshot({ lastSyncedAt: "2026-08-13T08:22:00Z" }), now);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/Last sync was \d+h ago/);
  });

  it("flags a missing or unparseable sync time", () => {
    expect(healthProblems(snapshot({ lastSyncedAt: null }), now)).toHaveLength(1);
    expect(healthProblems(snapshot({ lastSyncedAt: "garbage" }), now)).toHaveLength(1);
  });

  it("flags an empty bills table", () => {
    expect(healthProblems(snapshot({ bills: 0 }), now)).toEqual(["The bills table is empty."]);
  });

  it("flags failed and stuck emails", () => {
    const problems = healthProblems(
      snapshot({ outbox: { failedRecently: 2, stuckPending: 1 } }),
      now,
    );
    expect(problems).toHaveLength(2);
  });

  it("flags a run over the duration budget, with its counts", () => {
    const problems = healthProblems(snapshot({ lastRun: run({ durationMs: 47_250 }) }), now);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/took 47\.3s total, 19\.8s sync; fetched 187/);
  });

  it("accepts a run right at the budget", () => {
    expect(healthProblems(snapshot({ lastRun: run({ durationMs: 45_000 }) }), now)).toEqual([]);
  });

  it("flags a failed run", () => {
    const problems = healthProblems(
      snapshot({ lastRun: run({ ok: false, error: "LEGISinfo returned 503" }) }),
      now,
    );
    expect(problems).toEqual([
      expect.stringMatching(/Last sync run failed: LEGISinfo returned 503/),
    ]);
  });

  it("flags no recent run, which is what hitting the 60s limit looks like", () => {
    const problems = healthProblems(
      snapshot({ lastRun: run({ startedAt: "2026-09-27T23:00:01Z" }) }),
      now,
    );
    expect(problems).toEqual([expect.stringMatching(/Last recorded sync run started 26h ago/)]);
  });

  it("flags no recorded runs at all", () => {
    expect(healthProblems(snapshot({ lastRun: null }), now)).toEqual([
      "No sync run has been recorded in sync_runs.",
    ]);
  });
});
