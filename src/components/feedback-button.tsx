"use client";

import Script from "next/script";

/**
 * Feedback button → opens a Tally form as a modal popup. The form (fields, validation,
 * storage, notifications) lives in Tally; we just trigger it. Config-driven by a public form
 * id; if it's unset the button is hidden so we never render a dead control.
 *
 * Tally's embed script auto-wires any element carrying `data-tally-open`.
 */
const TALLY_FORM_ID = process.env.NEXT_PUBLIC_TALLY_FORM_ID;

export function FeedbackButton() {
  if (!TALLY_FORM_ID) return null;
  return (
    <>
      <Script src="https://tally.so/widgets/embed.js" strategy="afterInteractive" />
      <button
        type="button"
        data-tally-open={TALLY_FORM_ID}
        data-tally-layout="modal"
        data-tally-width="500"
        data-tally-overlay="1"
        className="rounded-md border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/20"
      >
        Feedback
      </button>
    </>
  );
}
