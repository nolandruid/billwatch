/**
 * Live checks against production and LEGISinfo, run daily by .github/workflows/health.yml
 * (and by hand with `npm run health`). Not part of `npm test`: these hit the network.
 */
import { describe, it, expect } from "vitest";
import { normalizeBill, type LegisinfoRawBill } from "@/lib/legisinfo";
import { ACTIVE_SESSIONS } from "@/lib/sync";

const SITE = (process.env.HEALTH_SITE_URL ?? "https://billwatch.ca").replace(/\/$/, "");
const LEGISINFO = "https://www.parl.ca/legisinfo/en";
const HEADERS = {
  "User-Agent": "BillWatch-HealthCheck/0.1 (+https://billwatch.ca)",
  Accept: "application/json",
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(`${url} returned ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

describe("site", () => {
  it("homepage is up", async () => {
    const res = await fetch(SITE, { cache: "no-store" });
    expect(res.status, `${SITE} returned ${res.status}`).toBe(200);
  });

  it("nightly sync ran and notification emails are going out", async () => {
    const res = await fetch(`${SITE}/api/health`, { cache: "no-store" });
    const isJson = res.headers.get("content-type")?.includes("application/json");
    expect(isJson, `${SITE}/api/health returned ${res.status} without JSON`).toBe(true);
    const body = (await res.json()) as { ok: boolean; problems: string[] };
    expect(body.problems, body.problems.join("\n")).toEqual([]);
    expect(res.status).toBe(200);
  });
});

describe.each(ACTIVE_SESSIONS)("LEGISinfo feed %s still parses", (session) => {
  let list: LegisinfoRawBill[] = [];

  it("session list normalizes into complete bills", async () => {
    list = await getJson<LegisinfoRawBill[]>(
      `${LEGISINFO}/bills/json?parlsession=${encodeURIComponent(session)}`,
    );
    expect(list.length, "LEGISinfo returned no bills").toBeGreaterThan(0);

    const broken = list
      .map((raw, i) => {
        try {
          const b = normalizeBill(raw);
          const missing = [
            !b.billNumber && "billNumber",
            !b.title && "title",
            !b.currentStatus && "currentStatus",
            !b.parliament && "parliament",
            !b.chamber && "chamber",
          ].filter(Boolean);
          return missing.length
            ? `#${i} ${b.billNumber ?? "?"}: missing ${missing.join(", ")}`
            : null;
        } catch (err) {
          return `#${i}: normalizeBill threw ${String(err)}`;
        }
      })
      .filter((x): x is string => x !== null);

    expect(broken, `LEGISinfo shape changed?\n${broken.slice(0, 10).join("\n")}`).toEqual([]);
  });

  it("per-bill record carries sponsor and activity date", async () => {
    // Government bills always have a sponsor; use the first one the list gives us.
    const first = list.map(normalizeBill).find((b) => b.billNumber.startsWith("C-"));
    expect(first, "no House bill in the list to probe").toBeDefined();
    const detail = await getJson<LegisinfoRawBill[]>(
      `${LEGISINFO}/bill/${session}/${first!.billNumber.toLowerCase()}/json`,
    );
    const b = normalizeBill(detail[0]);
    expect(b.billNumber).toBe(first!.billNumber);
    expect(b.sponsor, `per-bill record for ${b.billNumber} has no sponsor`).toBeTruthy();
    expect(b.activityDate, `per-bill record for ${b.billNumber} has no activity date`).toBeTruthy();
  });
});
