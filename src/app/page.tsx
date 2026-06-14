import { BillSearch } from "@/components/bill-search";
import { fetchBills, toListItem, type BillListItem } from "@/lib/legisinfo";
import { fetchSponsorPhotoMap, photoForSponsor } from "@/lib/sponsors";

// Pull fresh bill data from LEGISinfo, but cache it for an hour so the homepage stays fast
// and we don't hammer Parliament's servers on every visit.
export const revalidate = 3600;

const CURRENT_SESSION = "45-1";

export default async function Home() {
  let items: BillListItem[] = [];
  let loadError = false;
  try {
    const [bills, photoMap] = await Promise.all([
      fetchBills(CURRENT_SESSION),
      fetchSponsorPhotoMap(),
    ]);
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
            45th Parliament · Live from LEGISinfo
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
