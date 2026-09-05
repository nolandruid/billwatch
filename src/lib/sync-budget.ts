/**
 * Timing budget for the nightly cron.
 *
 * Vercel kills `/api/cron/sync` at `maxDuration = 60`. If a run ever crosses that line the
 * job dies silently: no bills updated, no emails sent, no error anyone sees. Because the
 * bills table grows over a parliamentary session and `syncSession` writes one row at a time,
 * the run gets slower over time rather than failing suddenly — so the useful signal is
 * "we're approaching the cap", not "we hit it".
 *
 * Every real run measures itself against the budget below and warns while there is still
 * headroom. Nothing to remember to run.
 */

/** Vercel's hard cap on the cron route (`maxDuration`). Crossing this kills the run. */
export const CRON_MAX_DURATION_MS = 60_000;

/** Warn here, leaving ~15s of headroom before Vercel pulls the plug. */
export const SYNC_BUDGET_MS = Number(process.env.SYNC_BUDGET_MS ?? 45_000);

export interface SyncTiming {
  elapsedMs: number;
  budgetMs: number;
  capMs: number;
  /** True once the run is slow enough to be worth a heads-up. */
  overBudget: boolean;
  /** Share of the hard cap used, rounded to a whole percent. */
  percentOfCap: number;
}

/** Measure one run against the budget. Pure, so the thresholds are unit-testable. */
export function evaluateSyncTiming(elapsedMs: number, budgetMs = SYNC_BUDGET_MS): SyncTiming {
  return {
    elapsedMs: Math.round(elapsedMs),
    budgetMs,
    capMs: CRON_MAX_DURATION_MS,
    overBudget: elapsedMs > budgetMs,
    percentOfCap: Math.round((elapsedMs / CRON_MAX_DURATION_MS) * 100),
  };
}
