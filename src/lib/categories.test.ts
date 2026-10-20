import { describe, expect, it } from "vitest";
import { categorizeBill, isCategory, queryMatchesCategory } from "./categories";

function bill(title: string, overrides: { billNumber?: string; shortTitle?: string } = {}) {
  return {
    parliament: 45,
    session: 1,
    billNumber: overrides.billNumber ?? "C-99",
    title,
    shortTitle: overrides.shortTitle ?? null,
  };
}

describe("categorizeBill", () => {
  it("tags from the long title", () => {
    expect(categorizeBill(bill("An Act to amend the Criminal Code (firearms)"))).toEqual([
      "justice",
    ]);
  });

  it("tags from the short title too", () => {
    expect(
      categorizeBill(
        bill("An Act respecting certain measures", { shortTitle: "Affordable Housing Act" }),
      ),
    ).toEqual(["housing"]);
  });

  it("can tag several topics", () => {
    expect(
      categorizeBill(
        bill("An Act to amend the Immigration and Refugee Protection Act and the Criminal Code"),
      ),
    ).toEqual(["immigration", "justice"]);
  });

  it("adds curated topics for omnibus bills", () => {
    const c15 = categorizeBill(
      bill(
        "An Act to implement certain provisions of the budget tabled in Parliament on November 4, 2025",
        {
          billNumber: "C-15",
          shortTitle: "Budget 2025 Implementation Act, No. 1",
        },
      ),
    );
    expect(c15).toContain("crypto");
    expect(c15).toContain("tax");
  });

  it("doesn't apply curated topics to the same number in another session", () => {
    expect(
      categorizeBill({ ...bill("An Act respecting X", { billNumber: "C-15" }), session: 2 }),
    ).toEqual([]);
  });

  it("only treats AI as a whole, uppercase word", () => {
    expect(categorizeBill(bill("An Act respecting fair dealing"))).toEqual([]);
    expect(categorizeBill(bill("An Act respecting AI systems"))).toEqual(["ai"]);
    expect(categorizeBill(bill("Artificial Intelligence and Data Act"))).toEqual(["ai"]);
  });

  it("doesn't match words inside other words", () => {
    expect(categorizeBill(bill("An Act respecting soil, sewage and laboratories"))).toEqual([]);
  });
});

describe("queryMatchesCategory", () => {
  it("matches a topic's label, key and terms", () => {
    expect(queryMatchesCategory("crypto", "crypto")).toBe(true);
    expect(queryMatchesCategory("Stablecoin Act", "crypto")).toBe(true);
    expect(queryMatchesCategory("hous", "housing")).toBe(true);
    expect(queryMatchesCategory("AI", "ai")).toBe(true);
  });

  it("ignores unrelated and very short queries", () => {
    expect(queryMatchesCategory("C-15", "crypto")).toBe(false);
    expect(queryMatchesCategory("a", "ai")).toBe(false);
    expect(queryMatchesCategory("ai", "crypto")).toBe(false);
  });
});

describe("isCategory", () => {
  it("accepts known keys only", () => {
    expect(isCategory("housing")).toBe(true);
    expect(isCategory("sports")).toBe(false);
  });
});
