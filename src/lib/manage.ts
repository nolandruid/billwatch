import type { SupabaseClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/resend";
import { isNotifyOn, type NotifyOn } from "@/lib/notify-prefs";

/**
 * "Manage my subscriptions" (the /manage page). A subscriber is identified by the
 * unsubscribe token that's already in every email, so there's no account or password: the
 * link is the credential, exactly like the one-click unsubscribe link.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isToken(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function manageUrl(unsubscribeToken: string): string {
  return `${siteUrl()}/manage?token=${unsubscribeToken}`;
}

/** "bud.druid@gmail.com" → "b•••d@gmail.com", so a forwarded link doesn't show the address. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "•••";
  const local = email.slice(0, at);
  const last = local.length > 2 ? local[local.length - 1] : "";
  return `${local[0]}•••${last}${email.slice(at)}`;
}

export interface ManagedSubscription {
  id: string;
  billNumber: string;
  title: string;
  shortTitle: string | null;
  notifyOn: NotifyOn;
}

export interface ManageView {
  maskedEmail: string;
  confirmed: boolean;
  subscriptions: ManagedSubscription[];
}

async function subscriberIdFor(supabase: SupabaseClient, token: string) {
  if (!isToken(token)) return null;
  const { data } = await supabase
    .from("subscribers")
    .select("id, email, confirmed")
    .eq("unsubscribe_token", token)
    .maybeSingle();
  return data as { id: string; email: string; confirmed: boolean } | null;
}

/** Everything the /manage page shows, or null for an unknown token. */
export async function getManageView(
  supabase: SupabaseClient,
  token: string,
): Promise<ManageView | null> {
  const sub = await subscriberIdFor(supabase, token);
  if (!sub) return null;
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, notify_on, bills!inner(bill_number, title, short_title)")
    .eq("subscriber_id", sub.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load subscriptions: ${error.message}`);

  const rows = (data ?? []) as unknown as {
    id: string;
    notify_on: string;
    bills: { bill_number: string; title: string; short_title: string | null };
  }[];
  return {
    maskedEmail: maskEmail(sub.email),
    confirmed: sub.confirmed,
    subscriptions: rows.map((r) => ({
      id: r.id,
      billNumber: r.bills.bill_number,
      title: r.bills.title,
      shortTitle: r.bills.short_title,
      notifyOn: isNotifyOn(r.notify_on) ? r.notify_on : "all",
    })),
  };
}

export type ManageAction =
  | { action: "set"; token: string; subscriptionId: string; notifyOn: NotifyOn }
  | { action: "remove"; token: string; subscriptionId: string };

/** Validate a POST /api/manage body. Returns an error message for anything malformed. */
export function parseManageRequest(body: unknown): ManageAction | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request." };
  const b = body as Record<string, unknown>;
  if (!isToken(b.token) || !isToken(b.subscriptionId)) return { error: "Invalid link." };
  if (b.action === "remove") {
    return { action: "remove", token: b.token, subscriptionId: b.subscriptionId };
  }
  if (b.action === "set") {
    if (!isNotifyOn(b.notifyOn)) return { error: "Invalid notification preference." };
    return {
      action: "set",
      token: b.token,
      subscriptionId: b.subscriptionId,
      notifyOn: b.notifyOn,
    };
  }
  return { error: "Invalid request." };
}

/**
 * Change one subscription's preference or remove it. Every write is scoped to the token's
 * subscriber, so a token can never touch someone else's subscription.
 */
export async function applyManageAction(
  supabase: SupabaseClient,
  req: ManageAction,
): Promise<{ ok: boolean }> {
  const sub = await subscriberIdFor(supabase, req.token);
  if (!sub) return { ok: false };
  const table = supabase.from("subscriptions");
  const query = req.action === "set" ? table.update({ notify_on: req.notifyOn }) : table.delete();
  const { data, error } = await query
    .eq("id", req.subscriptionId)
    .eq("subscriber_id", sub.id)
    .select("id")
    .maybeSingle();
  return { ok: !error && !!data };
}
