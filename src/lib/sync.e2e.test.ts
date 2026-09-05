/**
 * End-to-end performance check for the daily LEGISinfo sync.
 *
 * `/api/cron/sync` runs `syncAll` (fetch every bill for the active session, upsert into
 * Supabase, detect status changes, enqueue notifications) inside Vercel's `maxDuration = 60`
 * budget. A slow LEGISinfo response, a growing bills table, or extra round-trips per bill can
 * eat that budget silently until production cron starts 500ing. This test runs the real thing
 * and fails while there is still headroom.
 *
 * You should not normally need this: every production run times itself against the same
 * budget and emails OWNER_NOTIFY_EMAIL when it creeps up (see `@/lib/sync-budget`). Reach for
 * this when you want to measure a change before shipping it.
 *
 * It writes to whatever Supabase project the env points at, so it is opt-in and NOT part of
 * `npm test`. Point it at a staging project and run:
 *
 *   BILLWATCH_E2E=1 npm run test:e2e
 *
 * Required: BILLWATCH_E2E=1, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Optional: SYNC_BUDGET_MS (default 45000, well under the 60s cap).
 * Resend is never touched — the notify drain is not part of this test.
 */
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { fetchBills } from "@/lib/legisinfo";
import { syncAll, ACTIVE_SESSIONS } from "@/lib/sync";
import { SYNC_BUDGET_MS as BUDGET_MS } from "@/lib/sync-budget";

const enabled =
  process.env.BILLWATCH_E2E === "1" &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!enabled)("sync performance (e2e)", () => {
  it(`fetches every active session from LEGISinfo inside the budget`, async () => {
    const timings: Record<string, number> = {};
    for (const session of ACTIVE_SESSIONS) {
      const started = performance.now();
      const bills = await fetchBills(session);
      timings[session] = Math.round(performance.now() - started);
      // A session with no bills means the fetch or the session code is wrong, not that
      // Parliament is idle — the timing below would be meaninglessly fast.
      expect(bills.length).toBeGreaterThan(0);
      console.log(`[e2e] fetch ${session}: ${bills.length} bills in ${timings[session]}ms`);
    }
    const total = Object.values(timings).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThan(BUDGET_MS);
  });

  it(`runs syncAll (fetch + upsert + change detection) in under ${BUDGET_MS}ms`, async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const started = performance.now();
    const results = await syncAll(supabase);
    const elapsed = Math.round(performance.now() - started);

    // Printed so a regression is obvious in CI output even when the assertion passes.
    for (const r of results) {
      console.log(
        `[e2e] sync ${r.session}: fetched=${r.fetched} inserted=${r.inserted} ` +
          `changed=${r.changed} queued=${r.notificationsQueued}`,
      );
    }
    console.log(`[e2e] syncAll total: ${elapsed}ms (budget ${BUDGET_MS}ms, Vercel cap 60000ms)`);

    expect(results.length).toBe(ACTIVE_SESSIONS.length);
    expect(results.reduce((n, r) => n + r.fetched, 0)).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });
});
