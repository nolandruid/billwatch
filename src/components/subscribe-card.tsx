"use client";

import { useState } from "react";
import { Bell, Check } from "lucide-react";

type Status = "idle" | "sending" | "confirmation_sent" | "subscribed" | "error";

/**
 * Subscribe card on the bill detail page. Posts to /api/subscribe (CASL double opt-in).
 *
 * Visual: a deep-sage panel (not a pastel tint) so the primary CTA on the page feels
 * deliberate and editorial rather than templated.
 */
export function SubscribeCard({ billNumber }: { billNumber: string }) {
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

  const done = status === "confirmation_sent" || status === "subscribed";

  return (
    <div className="bg-brand-darker relative overflow-hidden rounded-2xl p-6 text-white shadow-sm">
      {/* faint paper texture echoing the site background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "16px 16px",
        }}
        aria-hidden
      />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="bg-cerise flex h-7 w-7 items-center justify-center rounded-full">
            <Bell className="h-3.5 w-3.5" />
          </span>
          <h2 className="font-display text-xl font-semibold">Get notified</h2>
        </div>

        {done ? (
          <div className="mt-4 flex items-start gap-2 text-sm text-white/85">
            <Check className="text-cerise mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {status === "confirmation_sent" ? (
                <>
                  Almost there: check your inbox and click the confirmation link to start getting
                  alerts for <span className="font-semibold text-white">{billNumber}</span>.
                </>
              ) : (
                <>
                  You&apos;re now tracking{" "}
                  <span className="font-semibold text-white">{billNumber}</span>. We&apos;ll email
                  you each time it changes status.
                </>
              )}
            </p>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed text-white/75">
              We&apos;ll email you each time {billNumber} advances a stage: first reading,
              committee, chamber to chamber, Royal Assent.
            </p>
            <form onSubmit={submit} className="mt-4 space-y-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@example.com"
                className="focus:ring-cerise w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/40 focus:border-transparent focus:ring-2"
              />
              {status === "error" && <p className="text-xs text-rose-200">{error}</p>}
              <button
                type="submit"
                disabled={status === "sending"}
                className="bg-cerise hover:bg-cerise-dark w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60"
              >
                {status === "sending" ? "Sending…" : "Notify me"}
              </button>
            </form>
            <p className="mt-3 text-xs text-white/45">
              Double opt-in · one-click unsubscribe · we never share your email.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
