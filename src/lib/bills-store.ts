import { createPublicClient } from "@/lib/supabase/server";
import {
  normalizeBill,
  type LegisinfoBillSummary,
  type NormalizedBill,
} from "@/lib/legisinfo";

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
      .select("source_json, last_synced_at")
      .order("last_synced_at", { ascending: false });
    if (error || !data) return { bills: [], lastSyncedAt: null };

    const bills = data
      .map((row) =>
        row.source_json ? normalizeBill(row.source_json as LegisinfoBillSummary) : null,
      )
      .filter((b): b is NormalizedBill => b !== null);

    return { bills, lastSyncedAt: (data[0]?.last_synced_at as string | null) ?? null };
  } catch {
    return { bills: [], lastSyncedAt: null };
  }
}
