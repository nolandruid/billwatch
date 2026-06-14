"use client";

import { useState } from "react";
import { Bell, Check } from "lucide-react";

/**
 * "Notify me" as an inline dialog: clicking the trigger opens a small modal that asks for an
 * email right there — no navigation to the bill page. The full double-opt-in flow lands once
 * /api/subscribe is wired; for now this captures intent and confirms.
 */
export function NotifyDialog({
  billNumber,
  triggerClassName,
}: {
  billNumber: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setDone(true);
  }

  function close() {
    setOpen(false);
    // Reset after the modal animates out so it's fresh next time.
    setTimeout(() => setDone(false), 200);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "bg-cerise hover:bg-cerise-dark inline-flex items-center rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition"
        }
      >
        Notify me
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={close}
        >
          <div
            className="bg-card w-full max-w-sm rounded-2xl p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-brand-darker flex items-center gap-2">
                <span className="bg-cerise flex h-7 w-7 items-center justify-center rounded-full text-white">
                  <Bell className="h-3.5 w-3.5" />
                </span>
                <h2 className="font-display text-lg font-semibold">Get notified</h2>
              </div>
              <button
                type="button"
                onClick={close}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {done ? (
              <div className="text-foreground/80 mt-4 flex items-start gap-2 text-sm">
                <Check className="text-cerise mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Thanks — we&apos;ll email you the moment{" "}
                  <span className="font-semibold">{billNumber}</span> changes status. (Confirmation
                  email lands once notifications go live.)
                </p>
              </div>
            ) : (
              <>
                <p className="text-foreground/65 mt-2 text-sm leading-relaxed">
                  We&apos;ll email you each time{" "}
                  <span className="text-foreground font-semibold">{billNumber}</span> advances a
                  stage — first reading, committee, chamber to chamber, Royal Assent.
                </p>
                <form onSubmit={submit} className="mt-4 space-y-2">
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@example.com"
                    className="border-mauve-deep/20 bg-background focus:border-cerise focus:ring-cerise/20 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2"
                  />
                  <button
                    type="submit"
                    className="bg-cerise hover:bg-cerise-dark w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition"
                  >
                    Notify me
                  </button>
                </form>
                <p className="text-foreground/45 mt-3 text-xs">
                  Double opt-in · one-click unsubscribe · we never share your email.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
