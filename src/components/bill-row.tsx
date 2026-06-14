import Link from "next/link";
import { SponsorAvatar } from "@/components/sponsor-avatar";
import { StatusBadge, stageMeta } from "@/components/status-badge";
import { ProgressTracker } from "@/components/progress-tracker";
import { chamberLabel } from "@/lib/legisinfo";
import type { BillListItem } from "@/lib/legisinfo";

function formatActivity(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Compact bill card (several per row). The whole card is a click target — a stretched
 * overlay link covers it — while the "Notify me" CTA sits above the overlay on its own z-layer.
 */
export function BillRow({ item }: { item: BillListItem }) {
  const href = `/bills/${item.slug}`;
  const meta = stageMeta(item.currentStatus);
  const heading = item.shortTitle ?? item.title;
  // When there's a distinct short title, show the formal long title as the description.
  const description = item.shortTitle ? item.title : null;
  const activity = formatActivity(item.activityDate);

  return (
    <article className="group bg-card relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg">
      {/* Stage-coloured top edge */}
      <span className={`absolute inset-x-0 top-0 h-1 ${meta.bar}`} aria-hidden />

      <div className="flex items-center gap-3">
        <SponsorAvatar
          name={item.sponsor}
          photoUrl={item.photoUrl}
          chamber={item.chamber}
          className="h-11 w-11 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-brand-darker font-mono text-lg font-bold tracking-tight">
              {item.billNumber}
            </span>
            <span className="truncate text-[11px] tracking-wide text-slate-400 uppercase">
              {item.chamber ? chamberLabel(item.chamber) : item.billType}
            </span>
          </div>
          {item.sponsor && (
            <p className="truncate text-xs text-slate-500">{item.sponsor}</p>
          )}
        </div>
      </div>

      <div className="mt-3">
        <StatusBadge status={item.currentStatus} />
      </div>

      <h3 className="font-display group-hover:text-cerise mt-3 line-clamp-2 text-base leading-snug font-semibold text-slate-900 transition-colors">
        {heading}
      </h3>
      {description && (
        <p className="text-foreground/55 mt-1.5 line-clamp-2 text-sm leading-relaxed">
          {description}
        </p>
      )}

      {/* Spacer keeps progress + footer aligned across cards of differing text length */}
      <div className="flex-1" />

      <div className="mt-5">
        <ProgressTracker steps={item.progress} />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-400">{activity ? `Updated ${activity}` : " "}</span>
        <Link
          href={href}
          className="bg-cerise hover:bg-cerise-dark relative z-10 inline-flex shrink-0 items-center rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition"
        >
          Notify me
        </Link>
      </div>

      {/* Stretched overlay: clicking anywhere on the card opens the bill */}
      <Link
        href={href}
        className="absolute inset-0 rounded-2xl"
        aria-label={`View ${item.billNumber}: ${heading}`}
      />
    </article>
  );
}
