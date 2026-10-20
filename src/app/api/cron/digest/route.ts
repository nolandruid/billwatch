import { createAdminClient } from "@/lib/supabase/admin";
import { sendWeeklyDigest } from "@/lib/digest";

/**
 * Weekly digest. Schedule is `0 13 * * *` in `vercel.json` (13:00 UTC = 9am EDT / 8am EST
 * Ottawa). Runs daily so failed sends retry the next morning; only the Monday run queues a
 * new digest (see sendWeeklyDigest). Protected by CRON_SECRET.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed if misconfigured
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const digest = await sendWeeklyDigest(createAdminClient());
    return Response.json({ ok: true, digest });
  } catch (err) {
    console.error("[cron/digest] failed:", err);
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
