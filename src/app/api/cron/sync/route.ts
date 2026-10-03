import { createAdminClient } from "@/lib/supabase/admin";
import { syncAll } from "@/lib/sync";
import { drainOutbox } from "@/lib/notify";
import { sendSittingDigest } from "@/lib/digest";

/**
 * Cron-triggered sync + notify. Pulls the latest bill data from LEGISinfo, detects status
 * changes, queues per-bill notifications, drains that outbox, then sends the sitting-end
 * digest to opt-in subscribers if any bills moved today.
 * Protected by CRON_SECRET, never call this unauthenticated.
 *
 * Vercel Cron invokes this via GET with `Authorization: Bearer <CRON_SECRET>`.
 * Schedule is `0 23 * * *` in `vercel.json` (23:00 UTC = 6pm EST / 7pm EDT Ottawa).
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
    const results = await syncAll(supabase);
    const notified = await drainOutbox(supabase);
    const digest = await sendSittingDigest(supabase);
    return Response.json({ ok: true, results, notified, digest });
  } catch (err) {
    console.error("[cron/sync] failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
