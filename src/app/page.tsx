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

// Brand marks (lucide dropped its logo icons), kept tiny for the under-headline credit line.
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.21 3.44 9.63 8.21 11.19.6.11.82-.26.82-.57v-2c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .31.22.69.83.57A12 12 0 0 0 24 12.29C24 5.78 18.63.5 12 .5Z" />
    </svg>
  );
}
function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    </svg>
  );
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
            email, and we&apos;ll tell you each time it advances: first reading, committee,
            House&nbsp;→&nbsp;Senate, Royal&nbsp;Assent.
          </p>
          <div
            className="op-rise text-foreground/50 mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs"
            style={{ animationDelay: "200ms" }}
          >
            <a
              href="https://github.com/nolandruid/billwatch"
              target="_blank"
              rel="noreferrer"
              className="hover:text-brand inline-flex items-center gap-1 transition"
            >
              <GithubIcon className="h-3.5 w-3.5" /> Free &amp; open source
            </a>
            <span aria-hidden className="text-foreground/25">
              ·
            </span>
            <a
              href="https://www.linkedin.com/in/nolandruid"
              target="_blank"
              rel="noreferrer"
              className="hover:text-brand inline-flex items-center gap-1 transition"
            >
              <LinkedinIcon className="h-3.5 w-3.5" /> LinkedIn
            </a>
          </div>
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
