import { describe, it, expect } from "vitest";
import {
  normalizeBill,
  billUrl,
  buildProgress,
  sponsorDisplayName,
  type LegisinfoBillRecord,
  type LegisinfoBillSummary,
} from "@/lib/legisinfo";

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
    PassedHouseFirstReadingDateTime: "2025-11-05T00:00:00",
    PassedHouseThirdReadingDateTime: "2025-12-01T00:00:00",
    PassedSenateFirstReadingDateTime: "2025-12-02T00:00:00",
    PassedSenateThirdReadingDateTime: "2026-05-20T00:00:00",
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

describe("buildProgress", () => {
  it("orders steps by originating chamber (House bill: House before Senate)", () => {
    const steps = buildProgress(makeRaw({ OriginatingChamberId: 1 }));
    expect(steps.map((s) => s.label)).toEqual([
      "Introduced",
      "Passed House",
      "Passed Senate",
      "Royal Assent",
    ]);
  });

  it("orders steps by originating chamber (Senate bill: Senate before House)", () => {
    const steps = buildProgress(makeRaw({ OriginatingChamberId: 2 }));
    expect(steps.map((s) => s.label)).toEqual([
      "Introduced",
      "Passed Senate",
      "Passed House",
      "Royal Assent",
    ]);
  });

  it("marks a step done only when its milestone date is present", () => {
    const steps = buildProgress(
      makeRaw({
        OriginatingChamberId: 1,
        PassedHouseThirdReadingDateTime: "2025-12-01T00:00:00",
        PassedSenateThirdReadingDateTime: null,
        ReceivedRoyalAssentDateTime: null,
      }),
    );
    expect(steps.map((s) => s.done)).toEqual([true, true, false, false]);
  });
});

// The list endpoint's shape since August 2026, trimmed from a real C-10 record.
function makeRecord(overrides: Partial<LegisinfoBillRecord> = {}): LegisinfoBillRecord {
  return {
    Id: 13455481,
    NumberCode: "C-10",
    ParliamentNumber: 45,
    SessionNumber: 1,
    LongTitleEn: "An Act respecting the Commissioner for Modern Treaty Implementation",
    ShortTitleEn: "Commissioner for Modern Treaty Implementation Act",
    BillDocumentTypeNameEn: "House Government Bill",
    OriginatingChamberOrganizationId: 1,
    StatusId: null,
    StatusNameEn: "House of Commons bill awaiting first reading in the Senate",
    LatestCompletedMajorStageNameEn: "Third reading",
    LatestCompletedMajorStageChamberOrganizationId: 1,
    LatestBillEventTypeNameEn: null,
    LatestBillEventDateTime: "0001-01-01T00:00:00",
    LatestCompletedBillStageDateTime: null,
    PassedHouseFirstReadingDateTime: "2025-09-25T06:03:12.167-04:00",
    PassedHouseSecondReadingDateTime: "2026-02-09T11:15:44-05:00",
    PassedHouseThirdReadingDateTime: "2026-09-21T14:15:16-04:00",
    PassedSenateFirstReadingDateTime: null,
    PassedSenateSecondReadingDateTime: null,
    PassedSenateThirdReadingDateTime: null,
    ReceivedRoyalAssentDateTime: null,
    SponsorPersonName: " ",
    SponsorPersonShortHonorificEn: null,
    ...overrides,
  };
}

describe("normalizeBill (current record shape)", () => {
  it("maps the renamed fields", () => {
    const n = normalizeBill(makeRecord());
    expect(n.billNumber).toBe("C-10");
    expect(n.parliament).toBe(45);
    expect(n.session).toBe(1);
    expect(n.billType).toBe("House Government Bill");
    expect(n.currentStatus).toBe("House of Commons bill awaiting first reading in the Senate");
    expect(n.currentStage).toBe("Third reading");
    expect(n.chamber).toBe("house");
    expect(n.originatingChamber).toBe("house");
    expect(n.legisinfoUrl).toBe("https://www.parl.ca/legisinfo/en/bill/45-1/c-10");
  });

  it("keeps the raw record as the source", () => {
    const raw = makeRecord();
    expect(normalizeBill(raw).source).toBe(raw);
  });

  it("treats the blank list sponsor as no sponsor", () => {
    const n = normalizeBill(makeRecord());
    expect(n.sponsor).toBeNull();
    expect(n.sponsorPerson).toBeNull();
  });

  it("falls back to the newest milestone when the event date is the 0001 placeholder", () => {
    expect(normalizeBill(makeRecord()).activityDate).toBe("2026-09-21T14:15:16-04:00");
  });

  it("uses a real event date when there is one", () => {
    const n = normalizeBill(makeRecord({ LatestBillEventDateTime: "2026-09-22T10:00:00" }));
    expect(n.activityDate).toBe("2026-09-22T10:00:00");
  });

  it("builds progress from the unchanged milestone fields", () => {
    expect(normalizeBill(makeRecord()).progress.map((s) => s.done)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
});

describe("normalizeBill (stored summary shape)", () => {
  it("still reads activity from LatestActivityDateTime", () => {
    expect(normalizeBill(makeRaw()).activityDate).toBe("2026-06-01T00:00:00");
  });
});

describe("sponsorDisplayName", () => {
  it("prefixes the honorific", () => {
    expect(
      sponsorDisplayName(
        makeRecord({ SponsorPersonName: "Rebecca Alty", SponsorPersonShortHonorificEn: "Hon." }),
      ),
    ).toBe("Hon. Rebecca Alty");
  });

  it("uses Sen. for Senate bills without an honorific", () => {
    expect(
      sponsorDisplayName(
        makeRecord({
          NumberCode: "S-226",
          SponsorPersonName: "Lucie Moncion",
          SponsorPersonShortHonorificEn: "",
        }),
      ),
    ).toBe("Sen. Lucie Moncion");
  });

  it("uses Sen. for Senate bills even when LEGISinfo says Hon.", () => {
    expect(
      sponsorDisplayName(
        makeRecord({
          NumberCode: "S-215",
          SponsorPersonName: "Amina Gerba",
          SponsorPersonShortHonorificEn: "Hon.",
        }),
      ),
    ).toBe("Sen. Amina Gerba");
  });

  it("uses the bare name for a House member without an honorific", () => {
    expect(
      sponsorDisplayName(
        makeRecord({ SponsorPersonName: "Mel Arnold", SponsorPersonShortHonorificEn: "" }),
      ),
    ).toBe("Mel Arnold");
  });

  it("returns null for a blank name", () => {
    expect(sponsorDisplayName(makeRecord())).toBeNull();
  });
});
