/**
 * What `/api/health` reports and how the daily health check judges it. Kept pure so the
 * thresholds are unit-testable; the route and the GitHub Actions check both use it.
 */

export interface HealthSnapshot {
  /** Newest bills.last_synced_at, or null if the table is empty. */
  lastSyncedAt: string | null;
  bills: number;
  outbox: {
    /** Emails that gave up after retries in the last day. */
    failedRecently: number;
    /** Emails still pending more than a day after being queued. */
    stuckPending: number;
  };
  /** The newest `sync_runs` row, or null if none has been recorded. */
  lastRun: SyncRun | null;
}

export interface SyncRun {
  startedAt: string;
  /** Whole cron run, sync plus email drain: what Vercel's 60s limit applies to. */
  durationMs: number;
  /** syncAll only: LEGISinfo fetch, upserts and change detection. */
  syncMs: number;
  ok: boolean;
  error: string | null;
  fetched: number;
  inserted: number;
  changed: number;
  notificationsQueued: number;
  emailsSent: number;
}

/**
 * The sync runs daily at 23:00 UTC and the check runs about two hours later, so anything
 * older than this means the most recent run did not write.
 */
export const MAX_SYNC_AGE_HOURS = 12;

/**
 * Vercel kills /api/cron/sync at 60s (`maxDuration`). Alert well before that so a slower
 * LEGISinfo or a growing bills table is caught while there is still headroom.
 */
export const SYNC_DURATION_BUDGET_MS = 45_000;

function describeRun(r: SyncRun): string {
  return (
    `${(r.durationMs / 1000).toFixed(1)}s total, ${(r.syncMs / 1000).toFixed(1)}s sync; ` +
    `fetched ${r.fetched}, inserted ${r.inserted}, changed ${r.changed}, ` +
    `queued ${r.notificationsQueued}, emailed ${r.emailsSent}`
  );
}

/** Human-readable problems, empty when everything is in order. */
export function healthProblems(s: HealthSnapshot, now: Date = new Date()): string[] {
  const problems: string[] = [];

  if (!s.lastSyncedAt) {
    problems.push("No bills have ever been synced.");
  } else {
    const ageHours = (now.getTime() - Date.parse(s.lastSyncedAt)) / 3_600_000;
    if (!(ageHours <= MAX_SYNC_AGE_HOURS)) {
      problems.push(
        `Last sync was ${Math.round(ageHours)}h ago (${s.lastSyncedAt}); ` +
          `expected within ${MAX_SYNC_AGE_HOURS}h. The nightly cron is failing or not running.`,
      );
    }
  }

  if (!s.lastRun) {
    problems.push("No sync run has been recorded in sync_runs.");
  } else {
    const r = s.lastRun;
    const ageHours = (now.getTime() - Date.parse(r.startedAt)) / 3_600_000;
    if (!(ageHours <= MAX_SYNC_AGE_HOURS)) {
      problems.push(
        `Last recorded sync run started ${Math.round(ageHours)}h ago (${r.startedAt}). ` +
          "Later runs failed before recording, most likely by hitting the 60s limit.",
      );
    }
    if (!r.ok) {
      problems.push(`Last sync run failed: ${r.error ?? "unknown error"} (${describeRun(r)}).`);
    }
    if (r.durationMs > SYNC_DURATION_BUDGET_MS) {
      problems.push(
        `Last sync run took ${describeRun(r)}, over the ` +
          `${SYNC_DURATION_BUDGET_MS / 1000}s budget (Vercel stops it at 60s).`,
      );
    }
  }

  if (s.bills === 0) problems.push("The bills table is empty.");

  if (s.outbox.failedRecently > 0) {
    problems.push(
      `${s.outbox.failedRecently} notification email(s) failed in the last day ` +
        "(see notifications_outbox.last_error).",
    );
  }
  if (s.outbox.stuckPending > 0) {
    problems.push(
      `${s.outbox.stuckPending} notification email(s) have been pending for over a day.`,
    );
  }

  return problems;
}

/** Map a `sync_runs` row onto SyncRun. */
export function toSyncRun(row: {
  started_at: string;
  duration_ms: number;
  sync_ms: number;
  ok: boolean;
  error: string | null;
  fetched: number;
  inserted: number;
  changed: number;
  notifications_queued: number;
  emails_sent: number;
}): SyncRun {
  return {
    startedAt: row.started_at,
    durationMs: row.duration_ms,
    syncMs: row.sync_ms,
    ok: row.ok,
    error: row.error,
    fetched: row.fetched,
    inserted: row.inserted,
    changed: row.changed,
    notificationsQueued: row.notifications_queued,
    emailsSent: row.emails_sent,
  };
}
