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
  sitting_date: string;
  subscribers: {
    email: string;
    unsubscribe_token: string;
    digest_opt_in: boolean;
    confirmed: boolean;
  };
}

export interface DigestSendResult {
  sittingDate: string;
  bills: number;
  queued: number;
  sent: number;
  failed: number;
}

/** Ottawa calendar date (YYYY-MM-DD). Parliament sits on Eastern Time. */
export function sittingDateInOttawa(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: OTTAWA_TZ });
}

export function isOnSittingDate(detectedAt: string, sittingDate: string): boolean {
  const at = new Date(detectedAt);
  if (Number.isNaN(at.getTime())) return false;
  return sittingDateInOttawa(at) === sittingDate;
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
 * Bills whose status/stage was detected on `sittingDate` (Ottawa). If a bill moved more
 * than once, keep the latest snapshot. Sorted by bill number so the email is stable.
 */
export function selectDigestBills(rows: DigestHistoryRow[], sittingDate: string): DigestBill[] {
  const latest = new Map<string, { detectedAt: string; bill: DigestBill }>();
  for (const row of rows) {
    if (!isOnSittingDate(row.detected_at, sittingDate)) continue;
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

/** Inclusive lower bound that covers a full Ottawa calendar day regardless of DST. */
export function historyLookupStart(sittingDate: string): string {
  const start = new Date(`${sittingDate}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - 1);
  return start.toISOString();
}

export async function loadDigestBills(
  supabase: SupabaseClient,
  sittingDate: string,
): Promise<DigestBill[]> {
  const { data, error } = await supabase
    .from("bill_status_history")
    .select("detected_at, status, stage, bills!inner(bill_number, title, legisinfo_url)")
    .gte("detected_at", historyLookupStart(sittingDate));
  if (error || !data) return [];
  return selectDigestBills(data as unknown as DigestHistoryRow[], sittingDate);
}

/** Queue one outbox row per confirmed digest subscriber. Idempotent on (subscriber, date). */
export async function enqueueDigest(
  supabase: SupabaseClient,
  sittingDate: string,
): Promise<number> {
  const { data: subs, error } = await supabase
    .from("subscribers")
    .select("id")
    .eq("confirmed", true)
    .eq("digest_opt_in", true);
  if (error) throw new Error(`Failed to load digest subscribers: ${error.message}`);
  if (!subs || subs.length === 0) return 0;

  const rows = subs.map((s) => ({
    subscriber_id: (s as { id: string }).id,
    sitting_date: sittingDate,
  }));

  const { error: insErr, count } = await supabase.from("digest_outbox").upsert(rows, {
    onConflict: "subscriber_id,sitting_date",
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
 * Drain pending digest rows. Loads the bill list for each row's sitting_date so a retry
 * the next day still sends yesterday's moves, not today's. sendEmail is a no-op without
 * RESEND_API_KEY (same as per-bill notify).
 */
export async function drainDigestOutbox(
  supabase: SupabaseClient,
  limit = 200,
): Promise<{ sent: number; failed: number }> {
  const { data, error } = await supabase
    .from("digest_outbox")
    .select(
      "id, attempts, sitting_date, subscribers!inner(email, unsubscribe_token, digest_opt_in, confirmed)",
    )
    .eq("state", "pending")
    .limit(limit);
  if (error || !data) return { sent: 0, failed: 0 };

  const billsByDate = new Map<string, DigestBill[]>();
  let sent = 0;
  let failed = 0;

  for (const row of data as unknown as DigestOutboxRow[]) {
    const sub = row.subscribers;
    if (!billsByDate.has(row.sitting_date)) {
      billsByDate.set(row.sitting_date, await loadDigestBills(supabase, row.sitting_date));
    }
    const bills = billsByDate.get(row.sitting_date) ?? [];

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
        sittingDate: row.sitting_date,
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
 * After the evening sync: if any bills changed on today's Ottawa sitting date, enqueue a
 * digest for opt-in subscribers, then drain. Always drains leftover pending rows so a
 * failed send can retry. Does not enroll anyone; only confirmed digest_opt_in rows.
 */
export async function sendSittingDigest(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<DigestSendResult> {
  const sittingDate = sittingDateInOttawa(now);
  const bills = await loadDigestBills(supabase, sittingDate);
  const queued = bills.length > 0 ? await enqueueDigest(supabase, sittingDate) : 0;
  const { sent, failed } = await drainDigestOutbox(supabase);
  return { sittingDate, bills: bills.length, queued, sent, failed };
}
