import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, siteUrl } from "@/lib/resend";
import { digestEmail } from "@/lib/emails";

const MAX_ATTEMPTS = 3;
const OTTAWA_TZ = "America/Toronto";

export interface DigestBill {
  billNumber: string;
  title: string;
  status: string | null;
  stage: string | null;
  legisinfoUrl: string;
}

export interface DigestHistoryRow {
  detected_at: string;
  status: string | null;
  stage: string | null;
  bills:
    | {
        bill_number: string;
        title: string;
        legisinfo_url: string;
      }
    | {
        bill_number: string;
        title: string;
        legisinfo_url: string;
      }[]
    | null;
}

interface DigestOutboxRow {
  id: string;
  attempts: number;
  digest_date: string;
  subscribers: {
    email: string;
    unsubscribe_token: string;
    digest_opt_in: boolean;
    confirmed: boolean;
  };
}

export interface DigestSendResult {
  digestDate: string;
  bills: number;
  queued: number;
  sent: number;
  failed: number;
}

/**
 * The digest is weekly: every Monday morning it lists each bill that changed status in the
 * previous seven days (Monday to Sunday, Ottawa time). The cron route runs daily so failed
 * sends retry the next morning, but only a Monday run queues a new digest.
 */
export const DIGEST_WEEKDAY = "Mon";

/** Whether `now` is the Ottawa weekday that queues a new digest. */
export function isDigestDay(now: Date = new Date()): boolean {
  return (
    new Intl.DateTimeFormat("en-CA", { timeZone: OTTAWA_TZ, weekday: "short" }).format(now) ===
    DIGEST_WEEKDAY
  );
}

/** Ottawa calendar date (YYYY-MM-DD). Parliament sits on Eastern Time. */
export function ottawaDate(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: OTTAWA_TZ });
}

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The seven Ottawa dates a digest sent on `digestDate` covers: the week before it. */
export function digestWindow(digestDate: string): { from: string; to: string } {
  return { from: addDays(digestDate, -7), to: addDays(digestDate, -1) };
}

export function isInDigestWindow(detectedAt: string, digestDate: string): boolean {
  const at = new Date(detectedAt);
  if (Number.isNaN(at.getTime())) return false;
  const day = ottawaDate(at);
  const { from, to } = digestWindow(digestDate);
  return day >= from && day <= to;
}

function billNumberSort(a: string, b: string): number {
  const parse = (n: string): [string, number] => {
    const [prefix, num] = n.split("-");
    return [prefix ?? "", Number(num) || 0];
  };
  const [pa, na] = parse(a);
  const [pb, nb] = parse(b);
  return pa === pb ? na - nb : pa.localeCompare(pb);
}

function unwrapBill(bills: DigestHistoryRow["bills"]): {
  bill_number: string;
  title: string;
  legisinfo_url: string;
} | null {
  if (!bills) return null;
  return Array.isArray(bills) ? (bills[0] ?? null) : bills;
}

/**
 * Bills whose status/stage changed in the week a digest sent on `digestDate` covers. If a bill
 * moved more than once, keep the latest snapshot. Sorted by bill number so the email is stable.
 */
export function selectDigestBills(rows: DigestHistoryRow[], digestDate: string): DigestBill[] {
  const latest = new Map<string, { detectedAt: string; bill: DigestBill }>();
  for (const row of rows) {
    if (!isInDigestWindow(row.detected_at, digestDate)) continue;
    const raw = unwrapBill(row.bills);
    if (!raw) continue;
    const prev = latest.get(raw.bill_number);
    if (prev && row.detected_at < prev.detectedAt) continue;
    latest.set(raw.bill_number, {
      detectedAt: row.detected_at,
      bill: {
        billNumber: raw.bill_number,
        title: raw.title,
        status: row.status,
        stage: row.stage,
        legisinfoUrl: raw.legisinfo_url,
      },
    });
  }
  return [...latest.values()]
    .map((entry) => entry.bill)
    .sort((a, b) => billNumberSort(a.billNumber, b.billNumber));
}

/** Lower bound for the history query: a day before the window, so no Ottawa hour is missed. */
export function historyLookupStart(digestDate: string): string {
  return `${addDays(digestWindow(digestDate).from, -1)}T00:00:00.000Z`;
}

export async function loadDigestBills(
  supabase: SupabaseClient,
  digestDate: string,
): Promise<DigestBill[]> {
  const { data, error } = await supabase
    .from("bill_status_history")
    .select("detected_at, status, stage, bills!inner(bill_number, title, legisinfo_url)")
    .gte("detected_at", historyLookupStart(digestDate));
  if (error || !data) return [];
  return selectDigestBills(data as unknown as DigestHistoryRow[], digestDate);
}

/** Queue one outbox row per confirmed digest subscriber. Idempotent on (subscriber, date). */
export async function enqueueDigest(supabase: SupabaseClient, digestDate: string): Promise<number> {
  const { data: subs, error } = await supabase
    .from("subscribers")
    .select("id")
    .eq("confirmed", true)
    .eq("digest_opt_in", true);
  if (error) throw new Error(`Failed to load digest subscribers: ${error.message}`);
  if (!subs || subs.length === 0) return 0;

  const rows = subs.map((s) => ({
    subscriber_id: (s as { id: string }).id,
    digest_date: digestDate,
  }));

  const { error: insErr, count } = await supabase.from("digest_outbox").upsert(rows, {
    onConflict: "subscriber_id,digest_date",
    ignoreDuplicates: true,
    count: "exact",
  });
  if (insErr) throw new Error(`Failed to enqueue digest: ${insErr.message}`);
  return count ?? rows.length;
}

async function markOutbox(
  supabase: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await supabase.from("digest_outbox").update(patch).eq("id", id);
}

/**
 * Drain pending digest rows. Loads the bill list for each row's digest_date so a retry
 * the next day still sends that week's moves. sendEmail is a no-op without
 * RESEND_API_KEY (same as per-bill notify).
 */
export async function drainDigestOutbox(
  supabase: SupabaseClient,
  limit = 200,
): Promise<{ sent: number; failed: number }> {
  const { data, error } = await supabase
    .from("digest_outbox")
    .select(
      "id, attempts, digest_date, subscribers!inner(email, unsubscribe_token, digest_opt_in, confirmed)",
    )
    .eq("state", "pending")
    .limit(limit);
  if (error || !data) return { sent: 0, failed: 0 };

  const billsByDate = new Map<string, DigestBill[]>();
  let sent = 0;
  let failed = 0;

  for (const row of data as unknown as DigestOutboxRow[]) {
    const sub = row.subscribers;
    if (!billsByDate.has(row.digest_date)) {
      billsByDate.set(row.digest_date, await loadDigestBills(supabase, row.digest_date));
    }
    const bills = billsByDate.get(row.digest_date) ?? [];

    // Opted out after enqueue, or nothing to list: close the row without mailing.
    if (!sub?.digest_opt_in || !sub.confirmed || bills.length === 0) {
      await markOutbox(supabase, row.id, {
        state: "sent",
        sent_at: new Date().toISOString(),
      });
      continue;
    }

    const unsubscribeUrl = `${siteUrl()}/api/unsubscribe?token=${sub.unsubscribe_token}&list=digest`;
    const origin = siteUrl();
    const ok = await sendEmail({
      to: sub.email,
      ...digestEmail({
        weekOf: digestWindow(row.digest_date),
        unsubscribeUrl,
        bills: bills.map((bill) => ({
          billNumber: bill.billNumber,
          title: bill.title,
          status: bill.status ?? "Status updated",
          billUrl: `${origin}/bills/${bill.billNumber.toLowerCase()}`,
          legisinfoUrl: bill.legisinfoUrl,
        })),
      }),
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    if (ok) {
      await markOutbox(supabase, row.id, {
        state: "sent",
        sent_at: new Date().toISOString(),
      });
      sent += 1;
    } else {
      const attempts = row.attempts + 1;
      await markOutbox(supabase, row.id, {
        state: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
        attempts,
        last_error: "email send failed",
      });
      failed += 1;
    }
  }

  return { sent, failed };
}

/**
 * The daily digest cron: on Mondays, queue this week's digest for confirmed opt-in
 * subscribers if any bills moved in the past week; every day, drain pending rows so failed
 * sends retry. Does not enroll anyone; only confirmed digest_opt_in rows.
 */
export async function sendWeeklyDigest(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<DigestSendResult> {
  const digestDate = ottawaDate(now);
  let bills = 0;
  let queued = 0;
  if (isDigestDay(now)) {
    bills = (await loadDigestBills(supabase, digestDate)).length;
    queued = bills > 0 ? await enqueueDigest(supabase, digestDate) : 0;
  }
  const { sent, failed } = await drainDigestOutbox(supabase);
  return { digestDate, bills, queued, sent, failed };
}
