import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, siteUrl } from "@/lib/resend";
import { confirmationEmail } from "@/lib/emails";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SubscribeStatus = "confirmation_sent" | "subscribed" | "error";

export interface SubscribeResult {
  ok: boolean;
  status: SubscribeStatus;
  message?: string;
}

/**
 * Subscribe an email to a bill. CASL double opt-in: a brand-new address gets a confirmation
 * email and receives nothing else until it confirms. An already-confirmed address starts
 * tracking immediately. Idempotent on (subscriber, bill).
 */
export async function subscribeToBill(
  supabase: SupabaseClient,
  rawEmail: string,
  billNumber: string,
): Promise<SubscribeResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, status: "error", message: "Please enter a valid email address." };
  }

  const { data: bill } = await supabase
    .from("bills")
    .select("id, bill_number, title")
    .ilike("bill_number", billNumber.trim())
    .limit(1)
    .maybeSingle();
  if (!bill) return { ok: false, status: "error", message: "We couldn't find that bill." };

  // Find or create the subscriber.
  let sub: { id: string; confirmed: boolean; confirm_token: string } | null = null;
  const existing = await supabase
    .from("subscribers")
    .select("id, confirmed, confirm_token")
    .eq("email", email)
    .maybeSingle();
  sub = existing.data;
  if (!sub) {
    const ins = await supabase
      .from("subscribers")
      .insert({ email })
      .select("id, confirmed, confirm_token")
      .single();
    if (ins.error || !ins.data) {
      return { ok: false, status: "error", message: "Something went wrong. Please try again." };
    }
    sub = ins.data;
  }

  // Record the subscription (unique on subscriber+bill makes this idempotent).
  await supabase
    .from("subscriptions")
    .upsert(
      { subscriber_id: sub.id, bill_id: bill.id },
      { onConflict: "subscriber_id,bill_id", ignoreDuplicates: true },
    );

  if (sub.confirmed) return { ok: true, status: "subscribed" };

  const confirmUrl = `${siteUrl()}/api/confirm?token=${sub.confirm_token}`;
  await sendEmail({
    to: email,
    ...confirmationEmail({ billNumber: bill.bill_number, billTitle: bill.title, confirmUrl }),
  });
  return { ok: true, status: "confirmation_sent" };
}

/** Flip a subscriber to confirmed via their confirm token. */
export async function confirmSubscriber(
  supabase: SupabaseClient,
  token: string | null,
): Promise<{ ok: boolean }> {
  if (!token) return { ok: false };
  const { data, error } = await supabase
    .from("subscribers")
    .update({ confirmed: true, confirmed_at: new Date().toISOString() })
    .eq("confirm_token", token)
    .select("id")
    .maybeSingle();
  return { ok: !error && !!data };
}

/** One-click unsubscribe: delete the subscriber (cascades to subscriptions + outbox). */
export async function unsubscribeByToken(
  supabase: SupabaseClient,
  token: string | null,
): Promise<{ ok: boolean }> {
  if (!token) return { ok: false };
  const { data, error } = await supabase
    .from("subscribers")
    .delete()
    .eq("unsubscribe_token", token)
    .select("id")
    .maybeSingle();
  return { ok: !error && !!data };
}
