import { SYNC_DURATION_BUDGET_MS, type SyncRun } from "@/lib/health";

/** What the owner's weekly status email summarizes. Gathered by /api/cron/weekly-report. */
export interface WeeklyStats {
  /** sync_runs started in the last 7 days. */
  runs: SyncRun[];
  subscribers: {
    confirmed: number;
    /** Confirmed during the last 7 days. */
    newConfirmed: number;
    /** Signed up but never confirmed (any age). */
    unconfirmed: number;
  };
  subscriptions: number;
  emails: { sent: number; failed: number };
}

/** The sync runs at least once every day, so each of the last 7 days should have a run. */
const DAYS = 7;

const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

/** Plain-text weekly report for the owner. Pure, so it's unit-testable. */
export function weeklyReport(stats: WeeklyStats): { subject: string; text: string } {
  const { runs, subscribers, emails } = stats;
  const failed = runs.filter((r) => !r.ok);
  const slow = runs.filter((r) => r.durationMs > SYNC_DURATION_BUDGET_MS);
  const slowest = runs.reduce<SyncRun | null>(
    (max, r) => (!max || r.durationMs > max.durationMs ? r : max),
    null,
  );
  const avgMs = runs.length ? runs.reduce((n, r) => n + r.durationMs, 0) / runs.length : 0;
  const changed = runs.reduce((n, r) => n + r.changed, 0);
  const inserted = runs.reduce((n, r) => n + r.inserted, 0);

  const issues: string[] = [];
  const daysWithRuns = new Set(runs.map((r) => r.startedAt.slice(0, 10))).size;
  if (daysWithRuns < DAYS) {
    issues.push(
      `${DAYS - daysWithRuns} of the last ${DAYS} days had no recorded sync run ` +
        "(usually a timeout at Vercel's 60s limit, or the cron not running).",
    );
  }
  if (failed.length) {
    issues.push(`${failed.length} run(s) failed, latest: ${failed[0]!.error ?? "unknown error"}`);
  }
  if (slow.length) {
    issues.push(`${slow.length} run(s) over the ${secs(SYNC_DURATION_BUDGET_MS)} budget.`);
  }
  if (emails.failed) issues.push(`${emails.failed} notification email(s) failed.`);

  const subject = issues.length
    ? `BillWatch weekly: ${issues.length} issue(s) need a look`
    : `BillWatch weekly: all good, ${subscribers.confirmed} subscribers`;

  const lines = [
    issues.length ? "Needs a look:" : "Everything ran normally this week.",
    ...issues.map((i) => `  - ${i}`),
    "",
    "Subscribers",
    `  Confirmed: ${subscribers.confirmed} (+${subscribers.newConfirmed} this week)`,
    `  Unconfirmed sign-ups: ${subscribers.unconfirmed}`,
    `  Bill subscriptions: ${stats.subscriptions}`,
    "",
    "Sync",
    `  Runs: ${runs.length} (${failed.length} failed)`,
    `  Average: ${secs(avgMs)}, slowest: ${slowest ? `${secs(slowest.durationMs)} on ${slowest.startedAt}` : "n/a"}`,
    `  Bill changes detected: ${changed}, new bills: ${inserted}`,
    "",
    "Notification emails",
    `  Sent: ${emails.sent}, failed: ${emails.failed}`,
  ];
  return { subject, text: lines.join("\n") };
}
