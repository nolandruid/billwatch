import { createPublicClient } from "@/lib/supabase/server";
import { normalizeBill, type LegisinfoRawBill, type NormalizedBill } from "@/lib/legisinfo";

/**
 * The LEGISinfo list no longer carries sponsors, so sync keeps them in the `sponsor` column
 * and that wins over whatever the stored record says.
 */
function fromRow(row: { source_json: unknown; sponsor: string | null }): NormalizedBill {
  const bill = normalizeBill(row.source_json as LegisinfoRawBill);
  return { ...bill, sponsor: row.sponsor ?? bill.sponsor };
}

export interface BillsSnapshot {
  bills: NormalizedBill[];
  /** When the cron last refreshed this data (max bills.last_synced_at), or null if empty. */
  lastSyncedAt: string | null;
}

/**
 * Read the bills the cron has mirrored into Supabase. We store each bill's raw LEGISinfo
 * record in `source_json`, so we can re-derive the full normalized shape (progress steps,
 * sponsor, etc.) without a second LEGISinfo round-trip. Returns an empty snapshot on any
 * error so callers can fall back to a live fetch.
 */
export async function getBillsSnapshot(): Promise<BillsSnapshot> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("bills")
      .select("source_json, sponsor, last_synced_at")
      .order("last_synced_at", { ascending: false });
    if (error || !data) return { bills: [], lastSyncedAt: null };

    const bills = data
      .map((row) => (row.source_json ? fromRow(row) : null))
      .filter((b): b is NormalizedBill => b !== null);

    return { bills, lastSyncedAt: (data[0]?.last_synced_at as string | null) ?? null };
  } catch {
    return { bills: [], lastSyncedAt: null };
  }
}

/**
 * Look up a single bill from Supabase by its number slug (e.g. "c-25"), re-derived from the
 * stored raw LEGISinfo record. Returns null if not found or on error so the page can 404
 * gracefully. Reading from our mirror keeps bill pages up even if LEGISinfo is down.
 */
export async function getBillBySlug(slug: string): Promise<NormalizedBill | null> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("bills")
      .select("source_json, sponsor")
      .ilike("bill_number", slug) // bill_number is stored "C-25"; the slug is "c-25"
      .limit(1)
      .maybeSingle();
    if (error || !data?.source_json) return null;
    return fromRow(data);
  } catch {
    return null;
  }
}
