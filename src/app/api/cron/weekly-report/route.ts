import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorized } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/resend";
import { toSyncRun } from "@/lib/health";
import { weeklyReport, type WeeklyStats } from "@/lib/weekly-report";

/**
 * Weekly status email to OWNER_NOTIFY_EMAIL: sync runs, subscriber growth and email delivery
 * for the last 7 days. Schedule is `0 13 * * 6` in `vercel.json` (Saturdays 13:00 UTC = 8am
 * EST / 9am EDT Ottawa). Protected by CRON_SECRET.
 */
export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  if (!isCronAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const owner = process.env.OWNER_NOTIFY_EMAIL;
  if (!owner) return Response.json({ ok: false, error: "OWNER_NOTIFY_EMAIL is not set" });

  try {
    const stats = await readStats();
    const report = weeklyReport(stats);
    const sent = await sendEmail({
      to: owner,
      subject: report.subject,
      html: toHtml(report.text),
      text: report.text,
    });
    return Response.json({ ok: sent, subject: report.subject });
  } catch (err) {
    console.error("[cron/weekly-report] failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

async function readStats(): Promise<WeeklyStats> {
  const supabase = createAdminClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();
  const count = { count: "exact" as const, head: true };

  const [runs, confirmed, newConfirmed, unconfirmed, subscriptions, sent, failed] =
    await Promise.all([
      supabase
        .from("sync_runs")
        .select(
          "started_at, duration_ms, sync_ms, ok, error, fetched, inserted, changed, notifications_queued, emails_sent",
        )
        .gte("started_at", weekAgo)
        .order("started_at", { ascending: false }),
      supabase.from("subscribers").select("id", count).eq("confirmed", true),
      supabase.from("subscribers").select("id", count).gte("confirmed_at", weekAgo),
      supabase.from("subscribers").select("id", count).eq("confirmed", false),
      supabase.from("subscriptions").select("id", count),
      supabase
        .from("notifications_outbox")
        .select("id", count)
        .eq("state", "sent")
        .gte("sent_at", weekAgo),
      supabase
        .from("notifications_outbox")
        .select("id", count)
        .eq("state", "failed")
        .gte("created_at", weekAgo),
    ]);

  for (const r of [runs, confirmed, newConfirmed, unconfirmed, subscriptions, sent, failed]) {
    if (r.error) throw new Error(`Weekly report query failed: ${r.error.message}`);
  }

  return {
    runs: (runs.data ?? []).map(toSyncRun),
    subscribers: {
      confirmed: confirmed.count ?? 0,
      newConfirmed: newConfirmed.count ?? 0,
      unconfirmed: unconfirmed.count ?? 0,
    },
    subscriptions: subscriptions.count ?? 0,
    emails: { sent: sent.count ?? 0, failed: failed.count ?? 0 },
  };
}

function toHtml(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<pre style="font-family: ui-monospace, Menlo, monospace; font-size: 13px">${escaped}</pre>`;
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
