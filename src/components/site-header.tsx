import Link from "next/link";
import { FeedbackButton } from "@/components/feedback-button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20">
      {/* Main masthead, in House-of-Commons chamber green. */}
      <div className="bg-commons text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center">
            <span className="font-display text-2xl leading-none font-semibold tracking-tight">
              BillWatch
            </span>
          </Link>
          <FeedbackButton />
        </div>
      </div>
      {/* Lighter sub-banner ribbon beneath. */}
      <div className="border-mauve-deep/15 bg-mauve-soft border-b">
        <p className="text-mauve-deep mx-auto max-w-5xl px-4 py-1.5 text-center font-mono text-[11px] tracking-[0.18em] uppercase">
          Tracking every bill before the Parliament of Canada
        </p>
      </div>
    </header>
  );
}
