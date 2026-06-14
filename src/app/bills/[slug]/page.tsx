import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { findBillBySlug, fetchSponsorPerson, chamberLabel } from "@/lib/legisinfo";
import { fetchSponsorPhotoMap, photoForSponsor } from "@/lib/sponsors";
import { SponsorAvatar } from "@/components/sponsor-avatar";
import { StatusBadge } from "@/components/status-badge";
import { ProgressTracker } from "@/components/progress-tracker";
import { SubscribeCard } from "@/components/subscribe-card";

export const revalidate = 3600;

const CURRENT_SESSION = "45-1";

function formatDate(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" });
}

// Stage ramp for the timeline dots, keyed by ProgressStep.key (literal classes for Tailwind).
const STAGE_DOT: Record<string, string> = {
  introduced: "bg-intro",
  "passed-first": "bg-second",
  "passed-second": "bg-third",
  "royal-assent": "bg-royal",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bill = await findBillBySlug(CURRENT_SESSION, slug).catch(() => null);
  if (!bill) return { title: "Bill not found | BillWatch" };
  return {
    title: `${bill.billNumber}: ${bill.shortTitle ?? bill.title} | BillWatch`,
    description: bill.title,
  };
}

export default async function BillPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [bill, photoMap, sponsorPerson] = await Promise.all([
    findBillBySlug(CURRENT_SESSION, slug).catch(() => null),
    fetchSponsorPhotoMap(),
    fetchSponsorPerson(CURRENT_SESSION, slug).catch(() => null),
  ]);

  if (!bill) notFound();

  const photoUrl = photoForSponsor(photoMap, bill.sponsor);
  const sponsor = sponsorPerson;
  // Newest first, so the latest milestone is at the top (no scrolling to find it).
  const timeline = bill.progress.filter((s) => s.date).reverse();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="text-foreground/60 hover:text-brand inline-flex items-center gap-1.5 text-sm font-medium transition"
        >
          <ArrowLeft className="h-4 w-4" /> All bills
        </Link>
        <a
          href={bill.legisinfoUrl}
          target="_blank"
          rel="noreferrer"
          className="border-brand/20 text-brand hover:bg-brand inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition hover:text-white"
        >
          Read the full bill on LEGISinfo <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Masthead */}
      <header className="op-rise border-brand/10 mt-6 border-b pb-6">
        <div className="flex items-center gap-3">
          <span className="text-brand-darker font-mono text-2xl font-bold tracking-tight">
            {bill.billNumber}
          </span>
          <StatusBadge status={bill.currentStatus} />
        </div>
        <h1 className="font-display text-foreground mt-3 text-3xl leading-tight font-semibold sm:text-4xl">
          {bill.shortTitle ?? bill.title}
        </h1>
        {bill.shortTitle && <p className="text-foreground/60 mt-2 leading-relaxed">{bill.title}</p>}
        <div className="text-foreground/50 mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {bill.billType && <span>{bill.billType}</span>}
          {bill.originatingChamber && (
            <span>Originated in the {chamberLabel(bill.originatingChamber)}</span>
          )}
        </div>
      </header>

      {/* Progress */}
      <section className="op-rise mt-8" style={{ animationDelay: "80ms" }}>
        <h2 className="text-brand font-mono text-sm font-semibold tracking-[0.15em] uppercase">
          Progress
        </h2>
        <div className="bg-card mt-4 rounded-2xl border border-slate-200 p-6">
          <ProgressTracker steps={bill.progress} />
        </div>
      </section>

      <div className="mt-8 grid gap-6 sm:grid-cols-5">
        {/* Sponsor */}
        <section className="op-rise sm:col-span-3" style={{ animationDelay: "120ms" }}>
          <h2 className="text-brand font-mono text-sm font-semibold tracking-[0.15em] uppercase">
            Sponsor
          </h2>
          <div className="bg-card mt-4 flex items-start gap-4 rounded-2xl border border-slate-200 p-5">
            <SponsorAvatar
              name={bill.sponsor}
              photoUrl={photoUrl}
              chamber={bill.chamber}
              className="h-16 w-16 shrink-0"
            />
            <div className="min-w-0">
              <p className="text-foreground font-semibold">{bill.sponsor ?? "Not specified"}</p>
              {sponsor?.title && (
                <p className="text-foreground/70 mt-0.5 text-sm">{sponsor.title}</p>
              )}
              {sponsor?.constituency && (
                <p className="text-foreground/50 mt-0.5 text-sm">{sponsor.constituency}</p>
              )}
            </div>
          </div>
        </section>

        {/* Subscribe */}
        <section className="op-rise sm:col-span-2" style={{ animationDelay: "160ms" }}>
          <h2 className="text-brand font-mono text-sm font-semibold tracking-[0.15em] uppercase">
            Track it
          </h2>
          <div className="mt-4">
            <SubscribeCard billNumber={bill.billNumber} />
          </div>
        </section>
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <section className="op-rise mt-8" style={{ animationDelay: "200ms" }}>
          <h2 className="text-brand font-mono text-sm font-semibold tracking-[0.15em] uppercase">
            Timeline
          </h2>
          <ol className="border-brand/15 mt-4 space-y-3 border-l-2 pl-5">
            {timeline.map((step) => (
              <li key={step.key} className="relative">
                <span
                  className={`${STAGE_DOT[step.key] ?? "bg-brand"} ring-background absolute top-1.5 -left-[1.5rem] h-2.5 w-2.5 rounded-full ring-4`}
                />
                <p className="text-foreground font-medium">{step.label}</p>
                <p className="text-foreground/50 text-sm">{formatDate(step.date)}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
