import { sponsorKey } from "@/lib/sponsors";
import type { BillListItem, Chamber } from "@/lib/legisinfo";

/** Fits the 3-column card grid (6 rows) and stays at or under the ~20-per-page target. */
export const BILL_PAGE_SIZE = 18;

export type SortKey = "recent" | "number" | "progress";
export type ChamberFilter = "all" | Chamber;
export type StatusFilter = "all" | "proposed" | "active" | "passed" | "died";

export interface BillListState {
  query: string;
  sort: SortKey;
  chamber: ChamberFilter;
  sponsor: string;
  status: StatusFilter;
  page: number;
}

export const BILL_LIST_DEFAULTS: BillListState = {
  query: "",
  sort: "recent",
  chamber: "all",
  sponsor: "all",
  status: "all",
  page: 1,
};

/** Bucket a bill into a coarse lifecycle stage for the status filter. */
export function statusCategory(item: BillListItem): Exclude<StatusFilter, "all"> {
  const s = (item.currentStatus ?? "").toLowerCase();
  if (s.includes("royal assent") || item.stageIndex >= 4) return "passed";
  if (s.includes("defeated") || s.includes("not proceed") || s.includes("withdrawn")) return "died";
  // Past its first chamber = actively moving; only introduced = still just proposed.
  return item.stageIndex >= 2 ? "active" : "proposed";
}

function billNumberValue(billNumber: string): [string, number] {
  const [prefix, num] = billNumber.split("-");
  return [prefix, Number(num) || 0];
}

export function compareBills(a: BillListItem, b: BillListItem, sort: SortKey): number {
  if (sort === "number") {
    const [pa, na] = billNumberValue(a.billNumber);
    const [pb, nb] = billNumberValue(b.billNumber);
    return pa === pb ? na - nb : pa.localeCompare(pb);
  }
  if (sort === "progress") {
    if (b.stageIndex !== a.stageIndex) return b.stageIndex - a.stageIndex;
  }
  // recent (and tie-breaker for progress): newest activity first.
  return (b.activityDate ?? "").localeCompare(a.activityDate ?? "");
}

export function filterAndSortBills(
  bills: BillListItem[],
  state: Pick<BillListState, "query" | "sort" | "chamber" | "sponsor" | "status">,
): BillListItem[] {
  const q = state.query.trim().toLowerCase();
  const compact = q.replace(/[\s-]/g, "");
  const result = bills.filter((b) => {
    if (state.chamber !== "all" && b.chamber !== state.chamber) return false;
    if (state.sponsor !== "all" && b.sponsor !== state.sponsor) return false;
    if (state.status !== "all" && statusCategory(b) !== state.status) return false;
    if (!q) return true;
    const num = b.billNumber.toLowerCase();
    return (
      num.includes(q) ||
      num.replace("-", "").includes(compact) ||
      b.title.toLowerCase().includes(q) ||
      (b.shortTitle?.toLowerCase().includes(q) ?? false) ||
      (b.sponsor?.toLowerCase().includes(q) ?? false)
    );
  });
  return result.sort((a, b) => compareBills(a, b, state.sort));
}

export interface PageSlice<T> {
  items: T[];
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  /** 1-based index of the first item on this page, or 0 when empty. */
  start: number;
  /** 1-based index of the last item on this page, or 0 when empty. */
  end: number;
}

export function paginate<T>(items: T[], page: number, pageSize = BILL_PAGE_SIZE): PageSlice<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Number.isFinite(page) ? Math.min(Math.max(1, Math.trunc(page)), pageCount) : 1;
  const startIdx = total === 0 ? 0 : (safePage - 1) * pageSize;
  const pageItems = items.slice(startIdx, startIdx + pageSize);
  return {
    items: pageItems,
    page: safePage,
    pageCount,
    pageSize,
    total,
    start: total === 0 ? 0 : startIdx + 1,
    end: startIdx + pageItems.length,
  };
}

export function parsePageParam(value: string | null | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.trunc(n);
}

export function parseBillListSearchParams(params: {
  get(name: string): string | null;
}): BillListState {
  const sortRaw = params.get("sort");
  const sort: SortKey =
    sortRaw === "number" || sortRaw === "progress" || sortRaw === "recent" ? sortRaw : "recent";
  const chamberRaw = params.get("chamber");
  const chamber: ChamberFilter =
    chamberRaw === "house" || chamberRaw === "senate" ? chamberRaw : "all";
  const statusRaw = params.get("status");
  const status: StatusFilter =
    statusRaw === "proposed" ||
    statusRaw === "active" ||
    statusRaw === "passed" ||
    statusRaw === "died"
      ? statusRaw
      : "all";
  const sponsor = params.get("sponsor")?.trim() || "all";
  return {
    query: params.get("q") ?? "",
    sort,
    chamber,
    sponsor,
    status,
    page: parsePageParam(params.get("page")),
  };
}

/** Build a query string, omitting defaults so `/` stays clean. */
export function serializeBillListSearchParams(state: BillListState): string {
  const params = new URLSearchParams();
  const q = state.query.trim();
  if (q) params.set("q", q);
  if (state.chamber !== "all") params.set("chamber", state.chamber);
  if (state.status !== "all") params.set("status", state.status);
  if (state.sponsor !== "all") params.set("sponsor", state.sponsor);
  if (state.sort !== "recent") params.set("sort", state.sort);
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}

export type PageWindowItem = number | "ellipsis";

/** Compact page list: `1 … 4 5 6 … 14`. */
export function pageWindow(current: number, pageCount: number): PageWindowItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, pageCount]);
  for (let i = current - 1; i <= current + 1; i++) {
    if (i >= 1 && i <= pageCount) pages.add(i);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const result: PageWindowItem[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i]! - sorted[i - 1]! > 1) result.push("ellipsis");
    result.push(sorted[i]!);
  }
  return result;
}

/** Unique sponsor names, sorted the same way as the homepage dropdown. */
export function uniqueSponsors(bills: BillListItem[]): string[] {
  const set = new Set(bills.map((b) => b.sponsor).filter((s): s is string => !!s));
  return [...set].sort((a, b) => sponsorKey(a).localeCompare(sponsorKey(b)));
}
