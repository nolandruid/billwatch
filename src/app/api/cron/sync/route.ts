import { createAdminClient } from "@/lib/supabase/admin";
import { syncAll, type SyncResult } from "@/lib/sync";
import { drainOutbox } from "@/lib/notify";
import { isCronAuthorized } from "@/lib/cron-auth";

/**
 * Cron-triggered sync + notify. Pulls the latest bill data from LEGISinfo, detects status
 * changes, queues notifications, then drains the outbox by emailing confirmed subscribers.
 * Protected by CRON_SECRET, never call this unauthenticated.
 *
 * Vercel Cron invokes this via GET with `Authorization: Bearer <CRON_SECRET>`.
 * Schedule is `0 23 * * *` in `vercel.json` (23:00 UTC = 6pm EST / 7pm EDT Ottawa).
 */
export const dynamic = "force-dynamic"; // always run fresh, never cache
export const maxDuration = 60;

async function handle(request: Request): Promise<Response> {
  if (!isCronAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const startedAt = new Date();
  let supabase: ReturnType<typeof createAdminClient> | null = null;
  let results: SyncResult[] = [];
  let syncMs = 0;
  let emailsSent = 0;
  try {
    supabase = createAdminClient();
    results = await syncAll(supabase);
    syncMs = Date.now() - startedAt.getTime();
    const notified = await drainOutbox(supabase);
    emailsSent = notified.sent;
    await recordRun(supabase, { startedAt, syncMs, results, emailsSent, error: null });
    return Response.json({
      ok: true,
      results,
      notified,
      durationMs: Date.now() - startedAt.getTime(),
    });
  } catch (err) {
    console.error("[cron/sync] failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    if (supabase) {
      await recordRun(supabase, { startedAt, syncMs, results, emailsSent, error: message });
    }
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * Log the run to `sync_runs` for the health check's duration budget. Best-effort: a failed
 * write is logged, never allowed to fail the sync itself.
 */
async function recordRun(
  supabase: ReturnType<typeof createAdminClient>,
  run: {
    startedAt: Date;
    syncMs: number;
    results: SyncResult[];
    emailsSent: number;
    error: string | null;
  },
): Promise<void> {
  const sum = (k: "fetched" | "inserted" | "changed" | "notificationsQueued") =>
    run.results.reduce((n, r) => n + r[k], 0);
  try {
    const { error } = await supabase.from("sync_runs").insert({
      started_at: run.startedAt.toISOString(),
      duration_ms: Date.now() - run.startedAt.getTime(),
      sync_ms: run.syncMs,
      ok: run.error === null,
      error: run.error,
      fetched: sum("fetched"),
      inserted: sum("inserted"),
      changed: sum("changed"),
      notifications_queued: sum("notificationsQueued"),
      emails_sent: run.emailsSent,
    });
    if (error) console.error("[cron/sync] could not record run:", error.message);
  } catch (err) {
    console.error("[cron/sync] could not record run:", err);
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
