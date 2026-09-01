import { describe, it, expect } from "vitest";
import type { BillListItem } from "@/lib/legisinfo";
import {
  BILL_PAGE_SIZE,
  compareBills,
  filterAndSortBills,
  pageWindow,
  paginate,
  parseBillListSearchParams,
  parsePageParam,
  serializeBillListSearchParams,
  statusCategory,
  uniqueSponsors,
} from "@/lib/bill-list";

function item(overrides: Partial<BillListItem> = {}): BillListItem {
  return {
    billNumber: "C-1",
    slug: "c-1",
    parliament: 45,
    session: 1,
    title: "An Act respecting something",
    shortTitle: "Something Act",
    sponsor: "Hon. Jane Doe",
    billType: "House Government Bill",
    chamber: "house",
    currentStatus: "Introduction and first reading in the House of Commons",
    legisinfoUrl: "https://www.parl.ca/legisinfo/en/bill/45-1/c-1",
    progress: [],
    photoUrl: null,
    activityDate: "2026-01-01T00:00:00",
    stageIndex: 1,
    ...overrides,
  };
}

describe("statusCategory", () => {
  it("treats royal assent and completed trackers as passed", () => {
    expect(statusCategory(item({ currentStatus: "Royal assent", stageIndex: 3 }))).toBe("passed");
    expect(statusCategory(item({ currentStatus: "At second reading", stageIndex: 4 }))).toBe(
      "passed",
    );
  });

  it("treats defeated / withdrawn / not proceeding as died", () => {
    expect(statusCategory(item({ currentStatus: "Defeated at second reading" }))).toBe("died");
    expect(statusCategory(item({ currentStatus: "Order to not proceed" }))).toBe("died");
    expect(statusCategory(item({ currentStatus: "Withdrawn from the Order Paper" }))).toBe("died");
  });

  it("splits remaining bills into proposed vs active by stage", () => {
    expect(statusCategory(item({ stageIndex: 1, currentStatus: "Introduced" }))).toBe("proposed");
    expect(statusCategory(item({ stageIndex: 2, currentStatus: "In committee" }))).toBe("active");
  });
});

describe("filterAndSortBills", () => {
  const bills = [
    item({
      billNumber: "C-15",
      slug: "c-15",
      title: "An Act to implement certain provisions of the budget",
      shortTitle: "Budget Implementation Act",
      sponsor: "Hon. François-Philippe Champagne",
      chamber: "house",
      stageIndex: 4,
      currentStatus: "Royal assent",
      activityDate: "2026-06-01T00:00:00",
    }),
    item({
      billNumber: "S-2",
      slug: "s-2",
      title: "An Act respecting the Senate ethics officer",
      shortTitle: null,
      sponsor: "Sen. Judith Seidman",
      chamber: "senate",
      stageIndex: 1,
      currentStatus: "Introduction and first reading",
      activityDate: "2026-03-01T00:00:00",
    }),
    item({
      billNumber: "C-2",
      slug: "c-2",
      title: "An Act to amend the Criminal Code",
      shortTitle: null,
      sponsor: "Hon. Jane Doe",
      chamber: "house",
      stageIndex: 2,
      currentStatus: "In committee",
      activityDate: "2026-05-01T00:00:00",
    }),
  ];

  const base = {
    query: "",
    sort: "recent" as const,
    chamber: "all" as const,
    sponsor: "all",
    status: "all" as const,
  };

  it("filters by chamber, status, and sponsor without dropping the others", () => {
    expect(
      filterAndSortBills(bills, { ...base, chamber: "senate" }).map((b) => b.billNumber),
    ).toEqual(["S-2"]);
    expect(
      filterAndSortBills(bills, { ...base, status: "passed" }).map((b) => b.billNumber),
    ).toEqual(["C-15"]);
    expect(
      filterAndSortBills(bills, { ...base, sponsor: "Hon. Jane Doe" }).map((b) => b.billNumber),
    ).toEqual(["C-2"]);
  });

  it("matches bill number, compacted number, title, short title, and sponsor", () => {
    expect(filterAndSortBills(bills, { ...base, query: "c-15" }).map((b) => b.billNumber)).toEqual([
      "C-15",
    ]);
    expect(filterAndSortBills(bills, { ...base, query: "c15" }).map((b) => b.billNumber)).toEqual([
      "C-15",
    ]);
    expect(
      filterAndSortBills(bills, { ...base, query: "budget" }).map((b) => b.billNumber),
    ).toEqual(["C-15"]);
    expect(
      filterAndSortBills(bills, { ...base, query: "criminal" }).map((b) => b.billNumber),
    ).toEqual(["C-2"]);
    expect(
      filterAndSortBills(bills, { ...base, query: "seidman" }).map((b) => b.billNumber),
    ).toEqual(["S-2"]);
  });

  it("keeps search and filters composable", () => {
    const result = filterAndSortBills(bills, {
      ...base,
      query: "act",
      chamber: "house",
      status: "active",
    });
    expect(result.map((b) => b.billNumber)).toEqual(["C-2"]);
  });

  it("sorts by recent activity, bill number, and progress", () => {
    expect(filterAndSortBills(bills, { ...base, sort: "recent" }).map((b) => b.billNumber)).toEqual(
      ["C-15", "C-2", "S-2"],
    );
    expect(filterAndSortBills(bills, { ...base, sort: "number" }).map((b) => b.billNumber)).toEqual(
      ["C-2", "C-15", "S-2"],
    );
    expect(
      filterAndSortBills(bills, { ...base, sort: "progress" }).map((b) => b.billNumber),
    ).toEqual(["C-15", "C-2", "S-2"]);
  });
});

describe("compareBills", () => {
  it("breaks progress ties with recency", () => {
    const older = item({ billNumber: "C-1", stageIndex: 2, activityDate: "2026-01-01T00:00:00" });
    const newer = item({ billNumber: "C-2", stageIndex: 2, activityDate: "2026-06-01T00:00:00" });
    expect(compareBills(older, newer, "progress")).toBeGreaterThan(0);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 40 }, (_, i) => i + 1);

  it("uses the homepage page size and slices a window", () => {
    expect(BILL_PAGE_SIZE).toBeLessThanOrEqual(20);
    const page1 = paginate(items, 1);
    expect(page1.items).toHaveLength(BILL_PAGE_SIZE);
    expect(page1.items[0]).toBe(1);
    expect(page1.start).toBe(1);
    expect(page1.end).toBe(BILL_PAGE_SIZE);
    expect(page1.pageCount).toBe(3);
    expect(page1.total).toBe(40);

    const page3 = paginate(items, 3);
    expect(page3.items).toEqual([37, 38, 39, 40]);
    expect(page3.start).toBe(37);
    expect(page3.end).toBe(40);
    expect(page3.page).toBe(3);
  });

  it("clamps out-of-range and invalid pages", () => {
    expect(paginate(items, 99).page).toBe(3);
    expect(paginate(items, 0).page).toBe(1);
    expect(paginate(items, Number.NaN).page).toBe(1);
  });

  it("handles an empty list without inventing items", () => {
    const empty = paginate([], 4);
    expect(empty).toMatchObject({
      items: [],
      page: 1,
      pageCount: 1,
      total: 0,
      start: 0,
      end: 0,
    });
  });

  it("paginates after filters so page 2 is a slice of the match set", () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      item({ billNumber: `C-${i + 1}`, slug: `c-${i + 1}`, title: `Climate bill ${i + 1}` }),
    );
    const filtered = filterAndSortBills(many, {
      query: "climate",
      sort: "number",
      chamber: "all",
      sponsor: "all",
      status: "all",
    });
    expect(filtered).toHaveLength(25);
    const page2 = paginate(filtered, 2);
    expect(page2.items).toHaveLength(7);
    expect(page2.items[0]?.billNumber).toBe("C-19");
    expect(page2.total).toBe(25);
  });
});

describe("parsePageParam", () => {
  it("defaults invalid values to page 1", () => {
    expect(parsePageParam(null)).toBe(1);
    expect(parsePageParam("")).toBe(1);
    expect(parsePageParam("nope")).toBe(1);
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("-2")).toBe(1);
    expect(parsePageParam("3.9")).toBe(3);
    expect(parsePageParam("2")).toBe(2);
  });
});

describe("parseBillListSearchParams / serializeBillListSearchParams", () => {
  it("round-trips non-default filters and omits defaults", () => {
    const state = {
      query: "budget",
      sort: "number" as const,
      chamber: "senate" as const,
      sponsor: "Sen. Judith Seidman",
      status: "active" as const,
      page: 2,
    };
    const qs = serializeBillListSearchParams(state);
    const parsed = parseBillListSearchParams(new URLSearchParams(qs));
    expect(parsed).toEqual(state);
    expect(serializeBillListSearchParams({ ...state, query: "", sort: "recent", page: 1 })).toBe(
      "chamber=senate&status=active&sponsor=Sen.+Judith+Seidman",
    );
  });

  it("falls back to defaults for unknown values", () => {
    const parsed = parseBillListSearchParams(
      new URLSearchParams("sort=popular&chamber=commons&status=maybe&page=abc"),
    );
    expect(parsed).toEqual({
      query: "",
      sort: "recent",
      chamber: "all",
      sponsor: "all",
      status: "all",
      page: 1,
    });
  });
});

describe("pageWindow", () => {
  it("lists every page when there are few", () => {
    expect(pageWindow(1, 4)).toEqual([1, 2, 3, 4]);
  });

  it("collapses the middle of a long range", () => {
    expect(pageWindow(1, 12)).toEqual([1, 2, "ellipsis", 12]);
    expect(pageWindow(6, 12)).toEqual([1, "ellipsis", 5, 6, 7, "ellipsis", 12]);
    expect(pageWindow(12, 12)).toEqual([1, "ellipsis", 11, 12]);
  });
});

describe("uniqueSponsors", () => {
  it("dedupes and sorts by normalized name", () => {
    expect(
      uniqueSponsors([
        item({ sponsor: "Hon. Jane Doe" }),
        item({ sponsor: "Hon. Jane Doe" }),
        item({ sponsor: "Sen. Judith Seidman" }),
        item({ sponsor: null }),
      ]),
    ).toEqual(["Hon. Jane Doe", "Sen. Judith Seidman"]);
  });
});
