"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Check } from "lucide-react";

type Status = "idle" | "sending" | "confirmation_sent" | "subscribed" | "error";

/**
 * "Notify me" as an inline dialog: clicking the trigger opens a small modal that asks for an
 * email right there, no navigation to the bill page. Posts to /api/subscribe (double opt-in).
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
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || status === "sending") return;
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, billNumber }),
      });
      const data = (await res.json()) as { ok: boolean; status?: Status; message?: string };
      if (data.ok && (data.status === "confirmation_sent" || data.status === "subscribed")) {
        setStatus(data.status);
      } else {
        setStatus("error");
        setError(data.message || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setError("Couldn't reach the server. Please try again.");
    }
  }

  function close() {
    setOpen(false);
    setTimeout(() => {
      setStatus("idle");
      setEmail("");
      setError("");
    }, 200);
  }

  const succeeded = status === "confirmation_sent" || status === "subscribed";

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

      {open &&
        createPortal(
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

              {succeeded ? (
                <div className="text-foreground/80 mt-4 flex items-start gap-2 text-sm">
                  <Check className="text-cerise mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    {status === "confirmation_sent" ? (
                      <>
                        Almost there: check your inbox and click the confirmation link to start
                        getting alerts for <span className="font-semibold">{billNumber}</span>.
                      </>
                    ) : (
                      <>
                        You&apos;re now tracking <span className="font-semibold">{billNumber}</span>
                        . We&apos;ll email you each time it changes status.
                      </>
                    )}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-foreground/65 mt-2 text-sm leading-relaxed">
                    We&apos;ll email you each time{" "}
                    <span className="text-foreground font-semibold">{billNumber}</span> advances a
                    stage: first reading, committee, chamber to chamber, Royal Assent.
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
                    {status === "error" && <p className="text-intro text-xs">{error}</p>}
                    <button
                      type="submit"
                      disabled={status === "sending"}
                      className="bg-cerise hover:bg-cerise-dark w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60"
                    >
                      {status === "sending" ? "Sending…" : "Notify me"}
                    </button>
                  </form>
                  <p className="text-foreground/45 mt-3 text-xs">
                    Double opt-in · one-click unsubscribe · we never share your email.
                  </p>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
