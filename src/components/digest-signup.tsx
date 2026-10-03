"use client";

import { useState } from "react";
import { Mail, Check } from "lucide-react";

type Status = "idle" | "sending" | "confirmation_sent" | "subscribed" | "error";

/**
 * Homepage opt-in for the sitting-end digest. Separate from per-bill Notify me:
 * one email after the House/Senate wrap, listing every bill that moved that day.
 */
export function DigestSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || status === "sending") return;
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/digest/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
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
    <div
      id="digest"
      className="bg-card scroll-mt-24 rounded-2xl border border-slate-200 p-6 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <span className="bg-commons flex h-7 w-7 items-center justify-center rounded-full text-white">
          <Mail className="h-3.5 w-3.5" />
        </span>
        <h2 className="font-display text-brand-darker text-xl font-semibold">Sitting-end digest</h2>
      </div>

      {done ? (
        <div className="text-foreground/80 mt-4 flex items-start gap-2 text-sm">
          <Check className="text-cerise mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {status === "confirmation_sent" ? (
              <>
                Almost there: check your inbox and click the confirmation link to start getting the
                sitting-end digest.
              </>
            ) : (
              <>
                You&apos;re on the digest. We&apos;ll email you once per sitting day when bills
                change status.
              </>
            )}
          </p>
        </div>
      ) : (
        <>
          <p className="text-foreground/70 mt-2 text-sm leading-relaxed">
            Prefer one email after the House and Senate wrap? We&apos;ll list every federal bill
            that changed status that day, with links to BillWatch and LEGISinfo. Separate from
            per-bill alerts, and off unless you opt in.
          </p>
          <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@example.com"
              className="border-mauve-deep/20 bg-background focus:border-cerise focus:ring-cerise/20 min-w-0 flex-1 rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="bg-cerise hover:bg-cerise-dark rounded-lg px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-white shadow-sm transition disabled:opacity-60"
            >
              {status === "sending" ? "Sending…" : "Send me the digest"}
            </button>
          </form>
          {status === "error" && <p className="text-intro mt-2 text-xs">{error}</p>}
          <p className="text-foreground/45 mt-3 text-xs">
            Double opt-in · one-click unsubscribe · we never share your email.
          </p>
        </>
      )}
    </div>
  );
}
