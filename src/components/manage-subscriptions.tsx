"use client";

import { useState } from "react";
import Link from "next/link";
import { NotifyOnSelect } from "@/components/notify-on-select";
import type { ManagedSubscription, ManageView } from "@/lib/manage";
import type { NotifyOn } from "@/lib/notify-prefs";

/** The list on /manage: change each bill's preference, drop a bill, or unsubscribe from all. */
export function ManageSubscriptions({ token, view }: { token: string; view: ManageView }) {
  const [subs, setSubs] = useState<ManagedSubscription[]>(view.subscriptions);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function post(body: Record<string, unknown>): Promise<boolean> {
    setError("");
    try {
      const res = await fetch("/api/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...body }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) setError(data.message || "Something went wrong. Please try again.");
      return data.ok;
    } catch {
      setError("Couldn't reach the server. Please try again.");
      return false;
    }
  }

  async function setPreference(sub: ManagedSubscription, notifyOn: NotifyOn) {
    setBusy(sub.id);
    setSaved(null);
    if (await post({ action: "set", subscriptionId: sub.id, notifyOn })) {
      setSubs((all) => all.map((s) => (s.id === sub.id ? { ...s, notifyOn } : s)));
      setSaved(sub.id);
    }
    setBusy(null);
  }

  async function remove(sub: ManagedSubscription) {
    setBusy(sub.id);
    if (await post({ action: "remove", subscriptionId: sub.id })) {
      setSubs((all) => all.filter((s) => s.id !== sub.id));
    }
    setBusy(null);
  }

  return (
    <div>
      <p className="text-foreground/60 mt-2 text-sm">
        Emails go to <span className="text-foreground font-medium">{view.maskedEmail}</span>
        {view.confirmed ? "." : " (not confirmed yet: check your inbox for the confirmation link)."}
      </p>

      {error && <p className="text-intro mt-4 text-sm">{error}</p>}

      {subs.length === 0 ? (
        <p className="border-mauve-deep/30 bg-card text-foreground/60 mt-6 rounded-xl border border-dashed p-8 text-center text-sm">
          You&apos;re not tracking any bills.{" "}
          <Link href="/" className="text-brand underline underline-offset-2">
            Find a bill to follow
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {subs.map((sub) => (
            <li key={sub.id} className="bg-card rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/bills/${sub.billNumber.toLowerCase()}`} className="group min-w-0">
                  <span className="text-brand-darker font-mono font-bold">{sub.billNumber}</span>
                  <span className="group-hover:text-cerise ml-2 text-sm text-slate-700">
                    {sub.shortTitle ?? sub.title}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => remove(sub)}
                  disabled={busy === sub.id}
                  className="text-foreground/50 hover:text-intro shrink-0 text-xs font-medium underline-offset-2 hover:underline disabled:opacity-50"
                >
                  Stop tracking
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-foreground/50 shrink-0 text-xs">Notify me about</span>
                <div className="flex-1">
                  <NotifyOnSelect
                    value={sub.notifyOn}
                    onChange={(v) => setPreference(sub, v)}
                    className="border-mauve-deep/20 bg-background focus:border-cerise w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none disabled:opacity-50"
                  />
                </div>
                {saved === sub.id && busy !== sub.id && (
                  <span className="text-xs text-emerald-700">Saved</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-foreground/50 mt-8 text-xs">
        Want to stop everything?{" "}
        <a
          href={`/api/unsubscribe?token=${token}`}
          className="hover:text-intro underline underline-offset-2"
        >
          Unsubscribe from all BillWatch emails
        </a>
        .
      </p>
    </div>
  );
}
