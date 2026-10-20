import { describe, it, expect } from "vitest";
import { healthProblems, type HealthSnapshot } from "@/lib/health";

const now = new Date("2026-09-29T01:17:00Z");

function snapshot(overrides: Partial<HealthSnapshot> = {}): HealthSnapshot {
  return {
    lastSyncedAt: "2026-09-28T23:00:05Z",
    bills: 187,
    outbox: { failedRecently: 0, stuckPending: 0 },
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
});
