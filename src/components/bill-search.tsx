"use client";

import { useCallback, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BillRow } from "@/components/bill-row";
import { BillPagination } from "@/components/bill-pagination";
import {
  type BillListState,
  type ChamberFilter,
  type SortKey,
  type StatusFilter,
  filterAndSortBills,
  paginate,
  parseBillListSearchParams,
  serializeBillListSearchParams,
  uniqueSponsors,
} from "@/lib/bill-list";
import type { BillListItem } from "@/lib/legisinfo";

const LEGEND: { label: string; dot: string }[] = [
  { label: "Introduced", dot: "bg-intro" },
  { label: "Second reading", dot: "bg-second" },
  { label: "In committee", dot: "bg-committee" },
  { label: "Third reading", dot: "bg-third" },
  { label: "Royal Assent", dot: "bg-royal" },
];

export function BillSearchFallback() {
  return (
    <div aria-hidden>
      <Skeleton className="bg-card h-12 w-full rounded-lg" />
      <div className="mt-4 flex justify-between gap-3">
        <Skeleton className="bg-card h-9 w-48 rounded-lg" />
        <Skeleton className="bg-card h-9 w-72 rounded-lg" />
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="bg-card h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function BillSearch({ bills }: { bills: BillListItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const listRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => parseBillListSearchParams(searchParams), [searchParams]);

  const replaceParams = useCallback(
    (patch: Partial<BillListState>) => {
      const next = { ...parseBillListSearchParams(searchParams), ...patch };
      const qs = serializeBillListSearchParams(next);
      const href = qs ? `${pathname}?${qs}` : pathname;
      router.replace(href, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const sponsors = useMemo(() => uniqueSponsors(bills), [bills]);

  const filtered = useMemo(() => filterAndSortBills(bills, parsed), [bills, parsed]);
  const paged = useMemo(() => paginate(filtered, parsed.page), [filtered, parsed.page]);

  const hrefForPage = useCallback(
    (page: number) => {
      const qs = serializeBillListSearchParams({ ...parsed, page });
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [parsed, pathname],
  );

  function setFilter(patch: Partial<BillListState>) {
    replaceParams({ ...patch, page: 1 });
  }

  function onPageNavigate() {
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const filtersActive =
    parsed.query.trim() ||
    parsed.chamber !== "all" ||
    parsed.sponsor !== "all" ||
    parsed.status !== "all";

  const selectClass =
    "rounded-md border border-mauve-deep/20 bg-card px-2.5 py-1.5 text-sm text-foreground shadow-sm outline-none focus:border-brand";

  return (
    <div>
      <Input
        type="search"
        value={parsed.query}
        onChange={(e) => setFilter({ query: e.target.value })}
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
              onClick={() => setFilter({ chamber: value as ChamberFilter })}
              className={`rounded-md px-3 py-1 font-medium transition ${
                parsed.chamber === value
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
              value={parsed.status}
              onChange={(e) => setFilter({ status: e.target.value as StatusFilter })}
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
              value={parsed.sponsor}
              onChange={(e) => setFilter({ sponsor: e.target.value })}
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
              value={parsed.sort}
              onChange={(e) => setFilter({ sort: e.target.value as SortKey })}
              className={selectClass}
            >
              <option value="recent">Recent activity</option>
              <option value="progress">Furthest along</option>
              <option value="number">Bill number</option>
            </select>
          </label>
        </div>
      </div>

      <div
        ref={listRef}
        className="mt-4 flex scroll-mt-24 flex-wrap items-center justify-between gap-3"
      >
        <p className="text-foreground/60 text-sm">
          <span className="text-foreground font-semibold">{filtered.length}</span>
          {filtersActive ? " bills match" : " bills in the 45th Parliament, 1st session"}
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
          {paged.items.map((bill) => (
            <BillRow key={`${bill.parliament}-${bill.session}-${bill.billNumber}`} item={bill} />
          ))}
        </div>
      )}

      <div onClick={onPageNavigate}>
        <BillPagination
          page={paged.page}
          pageCount={paged.pageCount}
          start={paged.start}
          end={paged.end}
          total={paged.total}
          hrefForPage={hrefForPage}
        />
      </div>
    </div>
  );
}
