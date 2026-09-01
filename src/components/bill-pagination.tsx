import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pageWindow } from "@/lib/bill-list";

const btn =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 font-medium transition";
const idle = "text-foreground/60 hover:text-foreground";
const current = "bg-brand text-white";
const disabled = "text-foreground/30 pointer-events-none";

export function BillPagination({
  page,
  pageCount,
  start,
  end,
  total,
  hrefForPage,
}: {
  page: number;
  pageCount: number;
  start: number;
  end: number;
  total: number;
  hrefForPage: (page: number) => string;
}) {
  if (pageCount <= 1 || total === 0) return null;

  return (
    <div className="mt-8 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-foreground/60 text-sm">
        Showing{" "}
        <span className="text-foreground font-semibold">
          {start}–{end}
        </span>{" "}
        of {total}
      </p>
      <nav
        aria-label="Bill list pages"
        className="border-mauve-deep/20 bg-card inline-flex items-center gap-0.5 rounded-lg border p-0.5 text-sm"
      >
        {page <= 1 ? (
          <span className={`${btn} ${disabled}`} aria-disabled="true">
            <ChevronLeft className="size-4" aria-hidden />
            <span className="sr-only">Previous page</span>
          </span>
        ) : (
          <Link href={hrefForPage(page - 1)} scroll={false} className={`${btn} ${idle}`}>
            <ChevronLeft className="size-4" aria-hidden />
            <span className="sr-only">Previous page</span>
          </Link>
        )}
        {pageWindow(page, pageCount).map((item, i) =>
          item === "ellipsis" ? (
            <span key={`ellipsis-${i}`} className="text-foreground/40 px-1.5" aria-hidden>
              …
            </span>
          ) : item === page ? (
            <span key={item} className={`${btn} ${current}`} aria-current="page">
              {item}
            </span>
          ) : (
            <Link key={item} href={hrefForPage(item)} scroll={false} className={`${btn} ${idle}`}>
              {item}
            </Link>
          ),
        )}
        {page >= pageCount ? (
          <span className={`${btn} ${disabled}`} aria-disabled="true">
            <ChevronRight className="size-4" aria-hidden />
            <span className="sr-only">Next page</span>
          </span>
        ) : (
          <Link href={hrefForPage(page + 1)} scroll={false} className={`${btn} ${idle}`}>
            <ChevronRight className="size-4" aria-hidden />
            <span className="sr-only">Next page</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
