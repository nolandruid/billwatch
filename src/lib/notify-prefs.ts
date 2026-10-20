/**
 * Per-subscription notification preferences (issue #22). Each subscription picks which kinds
 * of status change should email it; the sync classifies every change it detects and only
 * enqueues notifications for subscriptions whose preference matches.
 */

export const NOTIFY_ON = ["all", "milestones", "law", "died"] as const;
export type NotifyOn = (typeof NOTIFY_ON)[number];

export const DEFAULT_NOTIFY_ON: NotifyOn = "all";

/** Labels for the "Notify me about" selector. */
export const NOTIFY_ON_LABELS: Record<NotifyOn, string> = {
  all: "Every change",
  milestones: "Major milestones (passed a chamber, Royal Assent)",
  law: "Only when it becomes law",
  died: "Only if it dies (defeated, withdrawn)",
};

export function isNotifyOn(value: unknown): value is NotifyOn {
  return typeof value === "string" && (NOTIFY_ON as readonly string[]).includes(value);
}

/** The milestone timestamps we compare between syncs. Same field names in both LEGISinfo shapes. */
export interface MilestoneDates {
  houseThirdReading: string | null;
  senateThirdReading: string | null;
  royalAssent: string | null;
}

/** What kind of change a detected status change is. A change can be several at once. */
export interface ChangeKinds {
  passedChamber: boolean;
  becameLaw: boolean;
  died: boolean;
}

// LEGISinfo status wording for a bill that won't proceed, e.g. "Defeated at second reading",
// "Bill withdrawn", "Not proceeded with", "Motion negatived".
const DIED_RE = /defeat|withdrawn|not proceeded|negatived/i;

/** LEGISinfo writes 0001-01-01 for "no value"; treat it like null. */
function has(date: string | null | undefined): boolean {
  return !!date && !date.startsWith("0001-");
}

export function classifyChange(
  prev: { status: string | null; milestones: MilestoneDates },
  next: { status: string | null; milestones: MilestoneDates },
): ChangeKinds {
  const newly = (k: keyof MilestoneDates) => !has(prev.milestones[k]) && has(next.milestones[k]);
  return {
    passedChamber: newly("houseThirdReading") || newly("senateThirdReading"),
    becameLaw: newly("royalAssent"),
    died: DIED_RE.test(next.status ?? "") && !DIED_RE.test(prev.status ?? ""),
  };
}

/** The preferences that should be emailed about a change of these kinds. */
export function preferencesMatching(kinds: ChangeKinds): NotifyOn[] {
  const prefs: NotifyOn[] = ["all"];
  if (kinds.passedChamber || kinds.becameLaw) prefs.push("milestones");
  if (kinds.becameLaw) prefs.push("law");
  if (kinds.died) prefs.push("died");
  return prefs;
}
