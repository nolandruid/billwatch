import { createAdminClient } from "@/lib/supabase/admin";
import { healthProblems, toSyncRun, type HealthSnapshot } from "@/lib/health";

/**
 * Health snapshot for the daily check in `.github/workflows/health.yml`. Public, so it
 * returns counts and timestamps only, never subscriber data. The last sync time is already
 * shown on the homepage.
 */
export const dynamic = "force-dynamic"; // always read fresh, never cache

export async function GET() {
  try {
    const snapshot = await readSnapshot();
    const problems = healthProblems(snapshot);
    return Response.json({ ok: problems.length === 0, problems, ...snapshot });
  } catch (err) {
    console.error("[health] failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, problems: [message] }, { status: 500 });
  }
}

async function readSnapshot(): Promise<HealthSnapshot> {
  const supabase = createAdminClient();
  const dayAgo = new Date(Date.now() - 24 * 3_600_000).toISOString();

  const [latest, bills, failed, stuck, run] = await Promise.all([
    supabase
      .from("bills")
      .select("last_synced_at")
      .order("last_synced_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("bills").select("id", { count: "exact", head: true }),
    supabase
      .from("notifications_outbox")
      .select("id", { count: "exact", head: true })
      .eq("state", "failed")
      .gte("created_at", dayAgo),
    supabase
      .from("notifications_outbox")
      .select("id", { count: "exact", head: true })
      .eq("state", "pending")
      .lt("created_at", dayAgo),
    supabase
      .from("sync_runs")
      .select(
        "started_at, duration_ms, sync_ms, ok, error, fetched, inserted, changed, notifications_queued, emails_sent",
      )
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  for (const r of [latest, bills, failed, stuck, run]) {
    if (r.error) throw new Error(`Health query failed: ${r.error.message}`);
  }

  return {
    lastSyncedAt: (latest.data?.last_synced_at as string | null) ?? null,
    bills: bills.count ?? 0,
    outbox: { failedRecently: failed.count ?? 0, stuckPending: stuck.count ?? 0 },
    lastRun: run.data ? toSyncRun(run.data) : null,
  };
}
