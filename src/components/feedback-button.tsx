"use client";

import { useState } from "react";

type Status = "idle" | "sending" | "sent" | "error";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, email }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("sent");
      setMessage("");
      setEmail("");
    } catch {
      setStatus("error");
    }
  }

  function close() {
    setOpen(false);
    setStatus("idle");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/20"
      >
        Feedback
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Send feedback</h2>
              <button
                type="button"
                onClick={close}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {status === "sent" ? (
              <div className="py-6 text-center">
                <p className="text-sm font-medium text-slate-800">Thanks! 🙏</p>
                <p className="mt-1 text-sm text-slate-500">Your feedback was sent.</p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <p className="text-sm text-slate-500">
                  Bug, idea, a bill we&apos;re tracking wrong — or just good feedback? Tell us.
                </p>
                <div>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, 300))}
                    rows={4}
                    required
                    maxLength={300}
                    placeholder="Type your feedback here…"
                    className="focus:border-brand focus:ring-brand/20 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2"
                  />
                  <p className="mt-1 text-right text-xs text-slate-400">{message.length}/300</p>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email here (optional)"
                  className="focus:border-brand focus:ring-brand/20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2"
                />
                {status === "error" && (
                  <p className="text-sm text-red-600">
                    Couldn&apos;t send right now. Please try again later.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="bg-cerise hover:bg-cerise-dark w-full rounded-md px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
                >
                  {status === "sending" ? "Sending…" : "Send feedback"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
