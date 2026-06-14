import { BillSearch } from "@/components/bill-search";
import { fetchBills, toListItem, type BillListItem, type NormalizedBill } from "@/lib/legisinfo";
import { getBillsSnapshot } from "@/lib/bills-store";
import { fetchSponsorPhotoMap, photoForSponsor } from "@/lib/sponsors";

// Serve from our Supabase mirror, but revalidate hourly so a fresh cron run shows up promptly.
export const revalidate = 3600;

const CURRENT_SESSION = "45-1";

/** Format a sync timestamp in Eastern Time (Parliament's time zone). */
function formatLastUpdated(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-CA", {
    timeZone: "America/Toronto",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function Home() {
  let items: BillListItem[] = [];
  let lastUpdated: string | null = null;
  let loadError = false;
  try {
    const [snapshot, photoMap] = await Promise.all([getBillsSnapshot(), fetchSponsorPhotoMap()]);
    // Primary source is our DB (populated by the cron). If it's empty (e.g. before the first
    // sync) fall back to a live LEGISinfo fetch so the site is never blank.
    let bills: NormalizedBill[] = snapshot.bills;
    lastUpdated = formatLastUpdated(snapshot.lastSyncedAt);
    if (bills.length === 0) {
      bills = await fetchBills(CURRENT_SESSION);
    }
    // Most recent activity first so the freshest bills are on top.
    bills.sort((a, b) => {
      const at = a.source.LatestActivityDateTime ?? "";
      const bt = b.source.LatestActivityDateTime ?? "";
      return bt.localeCompare(at);
    });
    items = bills.map((bill) => toListItem(bill, photoForSponsor(photoMap, bill.sponsor)));
  } catch {
    loadError = true;
  }

  return (
    <div>
      <section className="border-brand/10 border-b">
        <div className="mx-auto max-w-3xl px-4 pt-16 pb-12 text-center">
          <p
            className="op-rise text-cerise/80 font-mono text-xs tracking-[0.25em] uppercase"
            style={{ animationDelay: "0ms" }}
          >
            45th Parliament · Sourced from LEGISinfo
          </p>
          <h1
            className="op-rise font-display text-brand-darker mt-5 text-5xl leading-[1.05] font-semibold tracking-tight sm:text-6xl"
            style={{ animationDelay: "80ms" }}
          >
            Know the moment
            <br />a bill <span className="text-cerise italic">moves.</span>
          </h1>
          <p
            className="op-rise text-foreground/70 mx-auto mt-6 max-w-xl text-lg leading-relaxed"
            style={{ animationDelay: "160ms" }}
          >
            Stop refreshing Parliament&apos;s website. Find a federal bill, subscribe with your
            email, and we&apos;ll tell you each time it advances — first reading, committee,
            House&nbsp;→&nbsp;Senate, Royal&nbsp;Assent.
          </p>
          {lastUpdated && (
            <p
              className="op-rise text-foreground/45 mt-6 inline-flex items-center gap-1.5 font-mono text-xs"
              style={{ animationDelay: "240ms" }}
            >
              <span className="bg-royal inline-block h-1.5 w-1.5 rounded-full" aria-hidden />
              Last updated {lastUpdated} ET
            </p>
          )}
        </div>
      </section>

      <section
        className="op-rise mx-auto max-w-5xl px-4 pt-10 pb-20"
        style={{ animationDelay: "240ms" }}
      >
        {loadError ? (
          <div className="border-intro/30 bg-intro-soft text-intro rounded-xl border p-6 text-center text-sm">
            We couldn&apos;t reach LEGISinfo just now. Please refresh in a moment.
          </div>
        ) : (
          <BillSearch bills={items} />
        )}
      </section>
    </div>
  );
}
