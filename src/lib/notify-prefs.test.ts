import { describe, expect, it } from "vitest";
import {
  classifyChange,
  isNotifyOn,
  preferencesMatching,
  type MilestoneDates,
} from "./notify-prefs";

const none: MilestoneDates = {
  houseThirdReading: null,
  senateThirdReading: null,
  royalAssent: null,
};

describe("classifyChange", () => {
  it("flags passing a chamber", () => {
    const kinds = classifyChange(
      { status: "At third reading in the House of Commons", milestones: none },
      {
        status: "House of Commons bill awaiting first reading in the Senate",
        milestones: { ...none, houseThirdReading: "2026-10-01T15:00:00" },
      },
    );
    expect(kinds).toEqual({ passedChamber: true, becameLaw: false, died: false });
  });

  it("flags Royal Assent", () => {
    const passed = { ...none, houseThirdReading: "2026-06-01", senateThirdReading: "2026-09-01" };
    const kinds = classifyChange(
      { status: "Awaiting royal assent", milestones: passed },
      { status: "Royal assent", milestones: { ...passed, royalAssent: "2026-10-01" } },
    );
    expect(kinds).toEqual({ passedChamber: false, becameLaw: true, died: false });
  });

  it("treats LEGISinfo's 0001-01-01 placeholder as no date", () => {
    const kinds = classifyChange(
      { status: "At committee", milestones: none },
      { status: "At report stage", milestones: { ...none, royalAssent: "0001-01-01T00:00:00" } },
    );
    expect(kinds).toEqual({ passedChamber: false, becameLaw: false, died: false });
  });

  it("flags a bill that dies, once", () => {
    const next = { status: "Defeated at second reading", milestones: none };
    expect(classifyChange({ status: "At second reading", milestones: none }, next).died).toBe(true);
    expect(classifyChange(next, { ...next, status: "Bill defeated" }).died).toBe(false);
    expect(
      classifyChange(
        { status: null, milestones: none },
        { status: "Bill withdrawn", milestones: none },
      ).died,
    ).toBe(true);
  });
});

describe("preferencesMatching", () => {
  it("always includes 'all'", () => {
    expect(preferencesMatching({ passedChamber: false, becameLaw: false, died: false })).toEqual([
      "all",
    ]);
  });

  it("sends chamber passage to milestones only", () => {
    expect(preferencesMatching({ passedChamber: true, becameLaw: false, died: false })).toEqual([
      "all",
      "milestones",
    ]);
  });

  it("sends Royal Assent to milestones and law", () => {
    expect(preferencesMatching({ passedChamber: false, becameLaw: true, died: false })).toEqual([
      "all",
      "milestones",
      "law",
    ]);
  });

  it("sends a death to died", () => {
    expect(preferencesMatching({ passedChamber: false, becameLaw: false, died: true })).toEqual([
      "all",
      "died",
    ]);
  });
});

describe("isNotifyOn", () => {
  it("accepts known values only", () => {
    expect(isNotifyOn("law")).toBe(true);
    expect(isNotifyOn("everything")).toBe(false);
    expect(isNotifyOn(undefined)).toBe(false);
  });
});
