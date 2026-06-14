import Link from "next/link";
import { FeedbackButton } from "@/components/feedback-button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20">
      <div className="bg-brand text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center">
            <span className="font-display text-2xl leading-none font-semibold tracking-tight">
              BillWatch
            </span>
          </Link>
          <FeedbackButton />
        </div>
      </div>
      {/* Centered sub-banner ribbon, in House-of-Commons chamber green. */}
      <div className="bg-commons border-b border-black/10">
        <p className="mx-auto max-w-5xl px-4 py-1.5 text-center font-mono text-[11px] tracking-[0.18em] text-white/80 uppercase">
          Tracking every bill before the Parliament of Canada
        </p>
      </div>
    </header>
  );
}
