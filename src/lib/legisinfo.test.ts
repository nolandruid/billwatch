import { describe, it, expect } from "vitest";
import { normalizeBill, billUrl, type LegisinfoBillSummary } from "@/lib/legisinfo";

function makeRaw(overrides: Partial<LegisinfoBillSummary> = {}): LegisinfoBillSummary {
  return {
    BillId: 13740928,
    BillNumberFormatted: "C-15",
    ParliamentNumber: 45,
    SessionNumber: 1,
    ParlSessionCode: "45-1",
    LongTitleEn: "An Act to implement certain provisions of the budget",
    ShortTitleEn: "Budget 2025 Implementation Act, No. 1",
    BillTypeEn: "House Government Bill",
    SponsorEn: "Hon. François-Philippe Champagne",
    OriginatingChamberId: 1,
    CurrentStatusId: 357,
    CurrentStatusEn: "Royal assent",
    LatestCompletedMajorStageEn: "Royal assent",
    LatestCompletedMajorStageChamberId: 2,
    LatestActivityEn: "Royal assent received",
    LatestActivityDateTime: "2026-06-01T00:00:00",
    ReceivedRoyalAssentDateTime: "2026-06-01T00:00:00",
    ...overrides,
  };
}

describe("billUrl", () => {
  it("lowercases the bill number and builds the LEGISinfo path", () => {
    expect(billUrl("45-1", "C-15")).toBe("https://www.parl.ca/legisinfo/en/bill/45-1/c-15");
  });
});

describe("normalizeBill", () => {
  it("maps core fields from the LEGISinfo payload", () => {
    const n = normalizeBill(makeRaw());
    expect(n.billNumber).toBe("C-15");
    expect(n.parliament).toBe(45);
    expect(n.session).toBe(1);
    expect(n.shortTitle).toBe("Budget 2025 Implementation Act, No. 1");
    expect(n.sponsor).toBe("Hon. François-Philippe Champagne");
    expect(n.currentStatus).toBe("Royal assent");
    expect(n.legisinfoUrl).toBe("https://www.parl.ca/legisinfo/en/bill/45-1/c-15");
  });

  it("maps chamber id 2 to senate and 1 to house", () => {
    expect(normalizeBill(makeRaw({ LatestCompletedMajorStageChamberId: 2 })).chamber).toBe(
      "senate",
    );
    expect(normalizeBill(makeRaw({ LatestCompletedMajorStageChamberId: 1 })).chamber).toBe("house");
  });

  it("falls back to originating chamber when latest stage chamber is missing", () => {
    const n = normalizeBill(
      makeRaw({ LatestCompletedMajorStageChamberId: null, OriginatingChamberId: 2 }),
    );
    expect(n.chamber).toBe("senate");
  });

  it("produces a statusKey that changes when activity advances", () => {
    const a = normalizeBill(makeRaw({ LatestActivityDateTime: "2026-05-01T00:00:00" }));
    const b = normalizeBill(makeRaw({ LatestActivityDateTime: "2026-06-01T00:00:00" }));
    expect(a.statusKey).not.toBe(b.statusKey);
  });

  it("treats empty short title and sponsor as null", () => {
    const n = normalizeBill(makeRaw({ ShortTitleEn: "", SponsorEn: null }));
    expect(n.shortTitle).toBeNull();
    expect(n.sponsor).toBeNull();
  });
});
