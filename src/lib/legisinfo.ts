/**
 * LEGISinfo client.
 *
 * LEGISinfo is the Parliament of Canada's official bill-tracking service and our single
 * source of truth for federal bill data. It exposes per-search and per-bill JSON exports.
 * This module is the ONLY place that knows LEGISinfo's response shape, if their format
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

export type Chamber = "house" | "senate";

/** Subset of the LEGISinfo fields we rely on. The payload has many more. */
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
  // Milestone timestamps (used for the progress tracker).
  PassedHouseFirstReadingDateTime: string | null;
  PassedHouseThirdReadingDateTime: string | null;
  PassedSenateFirstReadingDateTime: string | null;
  PassedSenateThirdReadingDateTime: string | null;
  ReceivedRoyalAssentDateTime: string | null;
  // Sponsor person details (present on the single-bill endpoint, used on detail pages).
  SponsorPersonId?: number | null;
  SponsorPersonName?: string | null;
  SponsorPersonShortHonorific?: string | null;
  SponsorAffiliationTitle?: string | null;
  SponsorAffiliationRoleName?: string | null;
  SponsorConstituencyName?: string | null;
}

/** One step in the bill's journey, for the GovTrack-style progress tracker. */
export interface ProgressStep {
  key: string;
  label: string;
  date: string | null;
  done: boolean;
}

export interface SponsorPerson {
  id: number | null;
  name: string;
  honorific: string | null;
  role: string | null; // e.g. "Minister"
  title: string | null; // e.g. "Minister of Finance and National Revenue"
  constituency: string | null;
}

/** Our normalized, storage-ready bill record (maps onto the `bills` table + UI). */
export interface NormalizedBill {
  billNumber: string;
  parliament: number;
  session: number;
  title: string;
  shortTitle: string | null;
  sponsor: string | null;
  billType: string | null;
  currentStatus: string | null;
  currentStage: string | null;
  chamber: Chamber | null;
  originatingChamber: Chamber | null;
  legisinfoUrl: string;
  progress: ProgressStep[];
  sponsorPerson: SponsorPerson | null;
  /**
   * Stable signal we diff on to detect "the bill moved". Combines the status and the
   * latest activity timestamp so any forward motion is caught even if the status label
   * is unchanged between sub-steps.
   */
  statusKey: string;
  source: LegisinfoBillSummary;
}

/**
 * Trimmed, client-safe view of a bill for list/row rendering. Excludes the heavy raw
 * `source` payload so we don't ship hundreds of full LEGISinfo records to the browser.
 */
export interface BillListItem {
  billNumber: string;
  slug: string; // lowercased number, for /bills/[slug]
  parliament: number;
  session: number;
  title: string;
  shortTitle: string | null;
  sponsor: string | null;
  billType: string | null;
  chamber: Chamber | null;
  currentStatus: string | null;
  legisinfoUrl: string;
  progress: ProgressStep[];
  photoUrl: string | null;
  activityDate: string | null;
  /** Number of completed progress steps, used for "furthest along" sorting. */
  stageIndex: number;
}

export function toListItem(bill: NormalizedBill, photoUrl: string | null): BillListItem {
  return {
    billNumber: bill.billNumber,
    slug: bill.billNumber.toLowerCase(),
    parliament: bill.parliament,
    session: bill.session,
    title: bill.title,
    shortTitle: bill.shortTitle,
    sponsor: bill.sponsor,
    billType: bill.billType,
    chamber: bill.chamber,
    currentStatus: bill.currentStatus,
    legisinfoUrl: bill.legisinfoUrl,
    progress: bill.progress,
    photoUrl,
    activityDate: bill.source.LatestActivityDateTime ?? null,
    stageIndex: bill.progress.filter((s) => s.done).length,
  };
}

function chamberFromId(id: number | null | undefined): Chamber | null {
  if (id == null) return null;
  return CHAMBER_BY_ID[id] ?? null;
}

export function chamberLabel(chamber: Chamber | null): string {
  if (chamber === "house") return "House of Commons";
  if (chamber === "senate") return "Senate";
  return "";
}

/** Build the public LEGISinfo URL for a bill (the "Source: LEGISinfo" link we always show). */
export function billUrl(parlSessionCode: string, billNumber: string): string {
  return `${BASE}/bill/${parlSessionCode}/${billNumber.toLowerCase()}`;
}

function thirdReading(raw: LegisinfoBillSummary, chamber: Chamber): string | null {
  return chamber === "house"
    ? raw.PassedHouseThirdReadingDateTime
    : raw.PassedSenateThirdReadingDateTime;
}

function firstReading(raw: LegisinfoBillSummary, chamber: Chamber): string | null {
  return chamber === "house"
    ? raw.PassedHouseFirstReadingDateTime
    : raw.PassedSenateFirstReadingDateTime;
}

/**
 * Build the four-step macro journey of a bill, ordered by its originating chamber:
 *   Introduced → Passed {first chamber} → Passed {second chamber} → Royal Assent
 */
export function buildProgress(raw: LegisinfoBillSummary): ProgressStep[] {
  const first = chamberFromId(raw.OriginatingChamberId) ?? "house";
  const second: Chamber = first === "house" ? "senate" : "house";

  const introducedDate = firstReading(raw, first);
  return [
    {
      key: "introduced",
      label: "Introduced",
      date: introducedDate,
      // If a bill is in LEGISinfo it has at least been introduced.
      done: true,
    },
    {
      key: "passed-first",
      label: `Passed ${first === "house" ? "House" : "Senate"}`,
      date: thirdReading(raw, first),
      done: !!thirdReading(raw, first),
    },
    {
      key: "passed-second",
      label: `Passed ${second === "house" ? "House" : "Senate"}`,
      date: thirdReading(raw, second),
      done: !!thirdReading(raw, second),
    },
    {
      key: "royal-assent",
      label: "Royal Assent",
      date: raw.ReceivedRoyalAssentDateTime,
      done: !!raw.ReceivedRoyalAssentDateTime,
    },
  ];
}

function sponsorPersonFrom(raw: LegisinfoBillDetail): SponsorPerson | null {
  const name = raw.SponsorPersonName?.trim();
  if (!name) return null;
  return {
    id: raw.SponsorPersonId ?? null,
    name,
    honorific: raw.SponsorPersonShortHonorific?.trim() || null,
    role: raw.SponsorAffiliationRoleName?.trim() || null,
    title: raw.SponsorAffiliationTitle?.trim() || null,
    constituency: raw.SponsorConstituencyName?.trim() || null,
  };
}

/** Map a raw LEGISinfo item into our normalized shape. Pure + unit-testable. */
export function normalizeBill(raw: LegisinfoBillSummary): NormalizedBill {
  const currentStatus = raw.CurrentStatusEn?.trim() || raw.LatestCompletedMajorStageEn || null;
  return {
    billNumber: raw.BillNumberFormatted,
    parliament: raw.ParliamentNumber,
    session: raw.SessionNumber,
    title: raw.LongTitleEn,
    shortTitle: raw.ShortTitleEn?.trim() || null,
    sponsor: raw.SponsorEn?.trim() || null,
    billType: raw.BillTypeEn?.trim() || null,
    currentStatus,
    currentStage: raw.LatestCompletedMajorStageEn ?? null,
    chamber: chamberFromId(raw.LatestCompletedMajorStageChamberId ?? raw.OriginatingChamberId),
    originatingChamber: chamberFromId(raw.OriginatingChamberId),
    legisinfoUrl: billUrl(raw.ParlSessionCode, raw.BillNumberFormatted),
    progress: buildProgress(raw),
    sponsorPerson: sponsorPersonFrom(raw),
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

/**
 * Find a single bill by its number slug (e.g. "c-15") within a session, using the LIST
 * endpoint, which carries the full milestone/progress data the per-bill endpoint lacks.
 */
export async function findBillBySlug(
  parlSessionCode: string,
  slug: string,
): Promise<NormalizedBill | null> {
  const bills = await fetchBills(parlSessionCode);
  const target = slug.toLowerCase();
  return bills.find((b) => b.billNumber.toLowerCase() === target) ?? null;
}

/**
 * The per-bill endpoint uses a DIFFERENT schema than the list (NumberCode, StatusNameEn, …),
 * but it is the only source for rich sponsor details (role, title, riding). We read just
 * those fields here. Returns null if unavailable.
 */
interface LegisinfoBillDetail {
  SponsorPersonId?: number | null;
  SponsorPersonName?: string | null;
  SponsorPersonShortHonorific?: string | null;
  SponsorAffiliationTitle?: string | null;
  SponsorAffiliationRoleName?: string | null;
  SponsorConstituencyName?: string | null;
}

export async function fetchSponsorPerson(
  parlSessionCode: string,
  slug: string,
): Promise<SponsorPerson | null> {
  const raw = await getJson<LegisinfoBillDetail[]>(
    `${BASE}/bill/${parlSessionCode}/${slug.toLowerCase()}/json`,
  );
  if (!raw || raw.length === 0) return null;
  return sponsorPersonFrom(raw[0]);
}
