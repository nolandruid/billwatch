import { createAdminClient } from "@/lib/supabase/admin";
import { syncAll } from "@/lib/sync";
import { drainOutbox } from "@/lib/notify";
import { evaluateSyncTiming } from "@/lib/sync-budget";
import { ownerSlowSyncAlert } from "@/lib/emails";
import { sendEmail } from "@/lib/resend";

/**
 * Cron-triggered sync + notify. Pulls the latest bill data from LEGISinfo, detects status
 * changes, queues notifications, then drains the outbox by emailing confirmed subscribers.
 * Protected by CRON_SECRET, never call this unauthenticated.
 *
 * Vercel Cron invokes this via GET with `Authorization: Bearer <CRON_SECRET>`.
 * Schedule is `0 23 * * *` in `vercel.json` (23:00 UTC = 6pm EST / 7pm EDT Ottawa).
 *
 * Every run times itself against the 60s `maxDuration` cap and emails the owner if it gets
 * close (see `@/lib/sync-budget`), so a slow-creeping sync surfaces before it starts dying.
 */
export const dynamic = "force-dynamic"; // always run fresh, never cache
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed if misconfigured
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function handle(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const supabase = createAdminClient();

    const started = performance.now();
    const results = await syncAll(supabase);
    const notified = await drainOutbox(supabase);
    const timing = evaluateSyncTiming(performance.now() - started);

    const fetched = results.reduce((n, r) => n + r.fetched, 0);
    console.log(
      `[cron/sync] ${timing.elapsedMs}ms (${timing.percentOfCap}% of cap) ` +
        `fetched=${fetched} notified=${notified}`,
    );
    if (timing.overBudget) await warnOwnerOfSlowSync(timing, fetched);

    return Response.json({ ok: true, results, notified, timing });
  } catch (err) {
    console.error("[cron/sync] failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * Heads-up that the sync is approaching Vercel's cap. Never throws: a failed warning email
 * must not fail an otherwise successful sync.
 */
async function warnOwnerOfSlowSync(
  timing: ReturnType<typeof evaluateSyncTiming>,
  fetched: number,
): Promise<void> {
  console.warn(
    `[cron/sync] SLOW: ${timing.elapsedMs}ms exceeds the ${timing.budgetMs}ms budget ` +
      `(cap ${timing.capMs}ms).`,
  );
  const owner = process.env.OWNER_NOTIFY_EMAIL;
  if (!owner) return;
  try {
    await sendEmail({ to: owner, ...ownerSlowSyncAlert({ ...timing, fetched }) });
  } catch (err) {
    console.error("[cron/sync] slow-sync alert failed to send:", err);
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
