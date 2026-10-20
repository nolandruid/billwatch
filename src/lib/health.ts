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
}

/**
 * The sync runs daily at 23:00 UTC and the check runs about two hours later, so anything
 * older than this means the most recent run did not write.
 */
export const MAX_SYNC_AGE_HOURS = 12;

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
