"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { BillRow } from "@/components/bill-row";
import { sponsorKey } from "@/lib/sponsors";
import type { BillListItem, Chamber } from "@/lib/legisinfo";

const LEGEND: { label: string; dot: string }[] = [
  { label: "Introduced", dot: "bg-intro" },
  { label: "Second reading", dot: "bg-second" },
  { label: "In committee", dot: "bg-committee" },
  { label: "Third reading", dot: "bg-third" },
  { label: "Royal Assent", dot: "bg-royal" },
];

type SortKey = "recent" | "number" | "progress";
type ChamberFilter = "all" | Chamber;
type StatusFilter = "all" | "proposed" | "active" | "passed" | "died";

/** Bucket a bill into a coarse lifecycle stage for the status filter. */
function statusCategory(item: BillListItem): Exclude<StatusFilter, "all"> {
  const s = (item.currentStatus ?? "").toLowerCase();
  if (s.includes("royal assent") || item.stageIndex >= 4) return "passed";
  if (s.includes("defeated") || s.includes("not proceed") || s.includes("withdrawn")) return "died";
  // Past its first chamber = actively moving; only introduced = still just proposed.
  return item.stageIndex >= 2 ? "active" : "proposed";
}

function billNumberValue(billNumber: string): [string, number] {
  const [prefix, num] = billNumber.split("-");
  return [prefix, Number(num) || 0];
}

function compareBills(a: BillListItem, b: BillListItem, sort: SortKey): number {
  if (sort === "number") {
    const [pa, na] = billNumberValue(a.billNumber);
    const [pb, nb] = billNumberValue(b.billNumber);
    return pa === pb ? na - nb : pa.localeCompare(pb);
  }
  if (sort === "progress") {
    if (b.stageIndex !== a.stageIndex) return b.stageIndex - a.stageIndex;
  }
  // recent (and tie-breaker for progress): newest activity first.
  return (b.activityDate ?? "").localeCompare(a.activityDate ?? "");
}

export function BillSearch({ bills }: { bills: BillListItem[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [chamber, setChamber] = useState<ChamberFilter>("all");
  const [sponsor, setSponsor] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Unique sponsors, sorted by (normalized) name for the dropdown.
  const sponsors = useMemo(() => {
    const set = new Set(bills.map((b) => b.sponsor).filter((s): s is string => !!s));
    return [...set].sort((a, b) => sponsorKey(a).localeCompare(sponsorKey(b)));
  }, [bills]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const compact = q.replace(/[\s-]/g, "");
    const result = bills.filter((b) => {
      if (chamber !== "all" && b.chamber !== chamber) return false;
      if (sponsor !== "all" && b.sponsor !== sponsor) return false;
      if (statusFilter !== "all" && statusCategory(b) !== statusFilter) return false;
      if (!q) return true;
      const num = b.billNumber.toLowerCase();
      return (
        num.includes(q) ||
        num.replace("-", "").includes(compact) ||
        b.title.toLowerCase().includes(q) ||
        (b.shortTitle?.toLowerCase().includes(q) ?? false) ||
        (b.sponsor?.toLowerCase().includes(q) ?? false)
      );
    });
    return result.sort((a, b) => compareBills(a, b, sort));
  }, [bills, query, sort, chamber, sponsor, statusFilter]);

  const selectClass =
    "rounded-md border border-mauve-deep/20 bg-card px-2.5 py-1.5 text-sm text-foreground shadow-sm outline-none focus:border-brand";

  return (
    <div>
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by bill number (e.g. C-15), title, topic, or sponsor…"
        className="bg-card h-12 text-base shadow-sm"
        autoFocus
      />

      {/* Controls */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Chamber segmented control */}
        <div className="border-mauve-deep/20 bg-card inline-flex rounded-lg border p-0.5 text-sm">
          {(
            [
              ["all", "All"],
              ["house", "House"],
              ["senate", "Senate"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setChamber(value)}
              className={`rounded-md px-3 py-1 font-medium transition ${
                chamber === value
                  ? "bg-brand text-white"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-foreground/50 flex items-center gap-1.5 text-xs">
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className={selectClass}
            >
              <option value="all">All statuses</option>
              <option value="proposed">Proposed</option>
              <option value="active">In progress</option>
              <option value="passed">Passed</option>
              <option value="died">Died</option>
            </select>
          </label>
          <label className="text-foreground/50 flex items-center gap-1.5 text-xs">
            Sponsor
            <select
              value={sponsor}
              onChange={(e) => setSponsor(e.target.value)}
              className={selectClass}
            >
              <option value="all">All sponsors</option>
              {sponsors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-foreground/50 flex items-center gap-1.5 text-xs">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className={selectClass}
            >
              <option value="recent">Recent activity</option>
              <option value="progress">Furthest along</option>
              <option value="number">Bill number</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-foreground/60 text-sm">
          <span className="text-foreground font-semibold">{filtered.length}</span>
          {query.trim() || chamber !== "all" || sponsor !== "all" || statusFilter !== "all"
            ? " bills match"
            : " bills in the 45th Parliament, 1st session"}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {LEGEND.map((l) => (
            <span key={l.label} className="text-foreground/50 flex items-center gap-1.5 text-xs">
              <span className={`h-2 w-2 rounded-full ${l.dot}`} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="border-mauve-deep/30 bg-card text-foreground/50 mt-10 rounded-xl border border-dashed p-12 text-center text-sm">
          No bills match your filters.
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((bill) => (
            <BillRow key={`${bill.parliament}-${bill.session}-${bill.billNumber}`} item={bill} />
          ))}
        </div>
      )}
    </div>
  );
}
