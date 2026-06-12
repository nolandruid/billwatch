/**
 * LEGISinfo client.
 *
 * LEGISinfo is the Parliament of Canada's official bill-tracking service and our single
 * source of truth for federal bill data. It exposes per-search and per-bill JSON exports.
 * This module is the ONLY place that knows LEGISinfo's response shape — if their format
 * changes, fix it here and nothing else should need to change.
 *
 * Endpoints (no auth, no documented rate limits; tech contact: infonet@parl.gc.ca):
 *   - List for a session:  https://www.parl.ca/legisinfo/en/bills/json?parlsession=45-1
 *   - Single bill:         https://www.parl.ca/legisinfo/en/bill/45-1/c-15/json
 *
 * Be a good citizen: identify ourselves via User-Agent and poll on a modest interval.
 */

const BASE = "https://www.parl.ca/legisinfo/en";
const USER_AGENT = "BillWatch/0.1 (+https://billwatch.ca; bill-status notifications)";

/** ChamberId values used throughout the LEGISinfo payload. */
const CHAMBER_BY_ID: Record<number, "house" | "senate"> = {
  1: "house",
  2: "senate",
};

/** Subset of the LEGISinfo list-item fields we rely on. The payload has many more. */
export interface LegisinfoBillSummary {
  BillId: number;
  BillNumberFormatted: string; // "C-15", "S-216"
  ParliamentNumber: number; // 45
  SessionNumber: number; // 1
  ParlSessionCode: string; // "45-1"
  LongTitleEn: string;
  ShortTitleEn: string;
  BillTypeEn: string;
  SponsorEn: string | null;
  OriginatingChamberId: number;
  CurrentStatusId: number | null;
  CurrentStatusEn: string | null;
  LatestCompletedMajorStageEn: string | null;
  LatestCompletedMajorStageChamberId: number | null;
  LatestActivityEn: string | null;
  LatestActivityDateTime: string | null;
  ReceivedRoyalAssentDateTime: string | null;
}

/** Our normalized, storage-ready bill record (maps onto the `bills` table). */
export interface NormalizedBill {
  billNumber: string;
  parliament: number;
  session: number;
  title: string;
  shortTitle: string | null;
  sponsor: string | null;
  currentStatus: string | null;
  currentStage: string | null;
  chamber: "house" | "senate" | null;
  legisinfoUrl: string;
  /**
   * Stable signal we diff on to detect "the bill moved". Combines the status and the
   * latest activity timestamp so any forward motion is caught even if the status label
   * is unchanged between sub-steps.
   */
  statusKey: string;
  source: LegisinfoBillSummary;
}

function chamberFromId(id: number | null | undefined): "house" | "senate" | null {
  if (id == null) return null;
  return CHAMBER_BY_ID[id] ?? null;
}

/** Build the public LEGISinfo URL for a bill (the "Source: LEGISinfo" link we always show). */
export function billUrl(parlSessionCode: string, billNumber: string): string {
  return `${BASE}/bill/${parlSessionCode}/${billNumber.toLowerCase()}`;
}

/** Map a raw LEGISinfo list item into our normalized shape. Pure + unit-testable. */
export function normalizeBill(raw: LegisinfoBillSummary): NormalizedBill {
  const currentStatus = raw.CurrentStatusEn?.trim() || raw.LatestCompletedMajorStageEn || null;
  return {
    billNumber: raw.BillNumberFormatted,
    parliament: raw.ParliamentNumber,
    session: raw.SessionNumber,
    title: raw.LongTitleEn,
    shortTitle: raw.ShortTitleEn?.trim() || null,
    sponsor: raw.SponsorEn?.trim() || null,
    currentStatus,
    currentStage: raw.LatestCompletedMajorStageEn ?? null,
    chamber: chamberFromId(raw.LatestCompletedMajorStageChamberId ?? raw.OriginatingChamberId),
    legisinfoUrl: billUrl(raw.ParlSessionCode, raw.BillNumberFormatted),
    statusKey: [
      raw.CurrentStatusId ?? "",
      raw.LatestCompletedMajorStageEn ?? "",
      raw.LatestActivityDateTime ?? "",
    ].join("|"),
    source: raw,
  };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    // We always want fresh data from Parliament, never a cached response.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`LEGISinfo request failed: ${res.status} ${res.statusText} for ${url}`);
  }
  return (await res.json()) as T;
}

/**
 * Fetch all bills for a parliamentary session (e.g. "45-1"), normalized.
 * This single call carries enough data to populate bills AND detect status changes,
 * so the sync job does not need per-bill requests.
 */
export async function fetchBills(parlSessionCode: string): Promise<NormalizedBill[]> {
  const raw = await getJson<LegisinfoBillSummary[]>(
    `${BASE}/bills/json?parlsession=${encodeURIComponent(parlSessionCode)}`,
  );
  return raw.map(normalizeBill);
}

/** Fetch a single bill's full detail (used by bill pages later). Returns the raw array. */
export async function fetchBill(
  parlSessionCode: string,
  billNumber: string,
): Promise<LegisinfoBillSummary[]> {
  return getJson<LegisinfoBillSummary[]>(
    `${BASE}/bill/${parlSessionCode}/${billNumber.toLowerCase()}/json`,
  );
}
