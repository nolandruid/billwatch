import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchBillsWithDetails, type NormalizedBill } from "@/lib/legisinfo";

/** Sessions to sync. Add new sessions here as Parliament opens them. */
export const ACTIVE_SESSIONS = ["45-1"];

export interface SyncResult {
  session: string;
  fetched: number;
  inserted: number;
  changed: number;
  notificationsQueued: number;
}

interface ExistingBill {
  id: string;
  bill_number: string;
  parliament: number;
  session: number;
  current_status: string | null;
  current_stage: string | null;
  sponsor: string | null;
  /** Set only when source_json is in LEGISinfo's current record shape. */
  number_code: string | null;
}

function key(parliament: number, session: number, billNumber: string): string {
  return `${parliament}-${session}-${billNumber}`;
}

/**
 * Sync one parliamentary session from LEGISinfo:
 *   1. Fetch all bills (the list, then each bill's full record for sponsor + activity).
 *   2. Upsert each into `bills`.
 *   3. For bills whose status/stage changed since we last saw them, append a
 *      `bill_status_history` row and enqueue notifications for confirmed subscribers.
 *
 * New bills are recorded but never trigger notifications (nobody could have subscribed yet).
 */
export async function syncSession(
  supabase: SupabaseClient,
  parlSessionCode: string,
): Promise<SyncResult> {
  const bills = await fetchBillsWithDetails(parlSessionCode);

  const { data: existingRows, error: existingErr } = await supabase
    .from("bills")
    .select(
      "id, bill_number, parliament, session, current_status, current_stage, sponsor, number_code:source_json->>NumberCode",
    );
  if (existingErr) throw new Error(`Failed to load existing bills: ${existingErr.message}`);

  const existingByKey = new Map<string, ExistingBill>();
  for (const row of (existingRows ?? []) as ExistingBill[]) {
    existingByKey.set(key(row.parliament, row.session, row.bill_number), row);
  }

  const result: SyncResult = {
    session: parlSessionCode,
    fetched: bills.length,
    inserted: 0,
    changed: 0,
    notificationsQueued: 0,
  };

  for (const bill of bills) {
    const existing = existingByKey.get(key(bill.parliament, bill.session, bill.billNumber));
    const isNew = !existing;
    // Rows stored before LEGISinfo's August 2026 schema switch hold stage text from a
    // different field, so only compare stage once both sides come from the same shape.
    // Otherwise a wording difference would email every subscriber about every bill.
    const sameShape = !!existing?.number_code;
    const statusChanged =
      !!existing &&
      (existing.current_status !== bill.currentStatus ||
        (sameShape && existing.current_stage !== bill.currentStage));

    // If a bill's detail request failed its record has no sponsor; keep the one we have.
    const sponsor = bill.sponsor ?? existing?.sponsor ?? null;

    const billId = await upsertBill(supabase, { ...bill, sponsor });

    if (isNew) {
      result.inserted += 1;
      // Record an initial history point but do not notify.
      await insertHistory(supabase, billId, bill);
      continue;
    }

    if (statusChanged) {
      result.changed += 1;
      const historyId = await insertHistory(supabase, billId, bill);
      result.notificationsQueued += await enqueueNotifications(supabase, billId, historyId);
    }
  }

  return result;
}

async function upsertBill(supabase: SupabaseClient, bill: NormalizedBill): Promise<string> {
  const { data, error } = await supabase
    .from("bills")
    .upsert(
      {
        bill_number: bill.billNumber,
        parliament: bill.parliament,
        session: bill.session,
        title: bill.title,
        short_title: bill.shortTitle,
        sponsor: bill.sponsor,
        current_status: bill.currentStatus,
        current_stage: bill.currentStage,
        chamber: bill.chamber,
        legisinfo_url: bill.legisinfoUrl,
        source_json: bill.source,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "parliament,session,bill_number" },
    )
    .select("id")
    .single();
  if (error) throw new Error(`Failed to upsert bill ${bill.billNumber}: ${error.message}`);
  return data.id as string;
}

async function insertHistory(
  supabase: SupabaseClient,
  billId: string,
  bill: NormalizedBill,
): Promise<string> {
  const { data, error } = await supabase
    .from("bill_status_history")
    .insert({
      bill_id: billId,
      status: bill.currentStatus,
      stage: bill.currentStage,
      chamber: bill.chamber,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to insert history for ${bill.billNumber}: ${error.message}`);
  return data.id as string;
}

/** Enqueue one outbox row per confirmed subscriber to the bill. Returns the count queued. */
async function enqueueNotifications(
  supabase: SupabaseClient,
  billId: string,
  historyId: string,
): Promise<number> {
  const { data: subs, error } = await supabase
    .from("subscriptions")
    .select("subscriber_id, subscribers!inner(confirmed)")
    .eq("bill_id", billId)
    .eq("subscribers.confirmed", true);
  if (error) throw new Error(`Failed to load subscribers for bill ${billId}: ${error.message}`);
  if (!subs || subs.length === 0) return 0;

  const rows = subs.map((s) => ({
    subscriber_id: (s as { subscriber_id: string }).subscriber_id,
    bill_id: billId,
    status_history_id: historyId,
  }));

  // Unique (subscriber_id, status_history_id) makes this idempotent across retries.
  const { error: insErr, count } = await supabase.from("notifications_outbox").upsert(rows, {
    onConflict: "subscriber_id,status_history_id",
    ignoreDuplicates: true,
    count: "exact",
  });
  if (insErr) throw new Error(`Failed to enqueue notifications: ${insErr.message}`);
  return count ?? rows.length;
}

/** Sync every active session. */
export async function syncAll(supabase: SupabaseClient): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (const session of ACTIVE_SESSIONS) {
    results.push(await syncSession(supabase, session));
  }
  return results;
}
