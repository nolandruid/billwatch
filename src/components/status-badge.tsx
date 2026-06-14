/**
 * Stage → colour, as an intuitive red → green progress ramp (everyone reads it instantly):
 *   red = just introduced   orange = second reading   yellow = in committee
 *   olive-green = third reading   green = passed (Royal Assent)
 *   slate = defeated / not proceeding (out of the race)
 */
export interface StageMeta {
  badge: string; // solid pill: background + text
  bar: string; // left accent bar on the card
  dot: string; // small status dot
  tint: string; // soft card background
}

export function stageMeta(status: string | null): StageMeta {
  const s = (status ?? "").toLowerCase();

  if (s.includes("royal assent"))
    return {
      badge: "bg-royal text-white",
      bar: "bg-royal",
      dot: "bg-royal",
      tint: "bg-royal-soft",
    };
  if (s.includes("defeated") || s.includes("not proceed") || s.includes("withdrawn"))
    return { badge: "bg-dead text-white", bar: "bg-dead", dot: "bg-dead", tint: "bg-dead-soft" };
  if (s.includes("third reading") || s.includes("report stage"))
    return {
      badge: "bg-third text-white",
      bar: "bg-third",
      dot: "bg-third",
      tint: "bg-third-soft",
    };
  if (s.includes("committee"))
    return {
      // Yellow needs dark text to stay legible.
      badge: "bg-committee text-stone-900",
      bar: "bg-committee",
      dot: "bg-committee",
      tint: "bg-committee-soft",
    };
  if (s.includes("second reading"))
    return {
      badge: "bg-second text-white",
      bar: "bg-second",
      dot: "bg-second",
      tint: "bg-second-soft",
    };
  if (s.includes("first reading"))
    return {
      badge: "bg-intro text-white",
      bar: "bg-intro",
      dot: "bg-intro",
      tint: "bg-intro-soft",
    };
  return {
    badge: "bg-slate-400 text-white",
    bar: "bg-slate-300",
    dot: "bg-slate-400",
    tint: "bg-slate-50",
  };
}

export function StatusBadge({
  status,
  compact = false,
}: {
  status: string | null;
  /** On cards, keep the pill to a single line (truncate) so cards stay uniform height. */
  compact?: boolean;
}) {
  const meta = stageMeta(status);
  return (
    <span
      title={compact ? (status ?? undefined) : undefined}
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${meta.badge} ${
        compact ? "max-w-full" : ""
      }`}
    >
      <span className={compact ? "truncate" : undefined}>{status ?? "Unknown"}</span>
    </span>
  );
}
