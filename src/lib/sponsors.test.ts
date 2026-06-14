import { describe, it, expect } from "vitest";
import { sponsorKey, initials, photoForSponsor } from "@/lib/sponsors";

describe("sponsorKey", () => {
  it("strips honorifics, diacritics, and case", () => {
    expect(sponsorKey("Hon. François-Philippe Champagne")).toBe("francois-philippe champagne");
    expect(sponsorKey("François-Philippe Champagne")).toBe("francois-philippe champagne");
    expect(sponsorKey("Sen. Judith Seidman")).toBe("judith seidman");
    expect(sponsorKey("Mr.  Ziad   Aboultaif")).toBe("ziad aboultaif");
  });
});

describe("initials", () => {
  it("returns first + last initial, ignoring honorifics", () => {
    expect(initials("Hon. François-Philippe Champagne")).toBe("FC");
    expect(initials("Judith Seidman")).toBe("JS");
    expect(initials("Cher")).toBe("C");
  });
});

describe("photoForSponsor", () => {
  const map = new Map([["francois-philippe champagne", "https://example.com/fpc.jpg"]]);
  it("matches regardless of honorific/accents", () => {
    expect(photoForSponsor(map, "Hon. François-Philippe Champagne")).toBe(
      "https://example.com/fpc.jpg",
    );
  });
  it("returns null for unknown or empty sponsors", () => {
    expect(photoForSponsor(map, "Sen. Judith Seidman")).toBeNull();
    expect(photoForSponsor(map, null)).toBeNull();
  });
});
