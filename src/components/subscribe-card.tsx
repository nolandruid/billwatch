"use client";

import { useState } from "react";
import { Bell, Check } from "lucide-react";

/**
 * Subscribe card. The full double-opt-in flow is wired once Supabase is connected; for now
 * this captures intent and confirms to the user. It posts to /api/subscribe when available.
 *
 * Visual: a deep-sage panel (not a pastel tint) so the primary CTA on the page feels
 * deliberate and editorial rather than templated.
 */
export function SubscribeCard({ billNumber }: { billNumber: string }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setDone(true);
  }

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
              We&apos;ll email you the moment{" "}
              <span className="font-semibold text-white">{billNumber}</span> changes status.
              (Confirmation email lands once notifications go live.)
            </p>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed text-white/75">
              We&apos;ll email you each time {billNumber} advances a stage — first reading,
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
              <button
                type="submit"
                className="bg-cerise hover:bg-cerise-dark w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition"
              >
                Notify me
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
