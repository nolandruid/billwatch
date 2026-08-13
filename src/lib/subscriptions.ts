import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, siteUrl } from "@/lib/resend";
import { confirmationEmail, ownerSignupAlert, subscribedEmail } from "@/lib/emails";

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
  let sub: {
    id: string;
    confirmed: boolean;
    confirm_token: string;
    unsubscribe_token: string;
  } | null = null;
  const existing = await supabase
    .from("subscribers")
    .select("id, confirmed, confirm_token, unsubscribe_token")
    .eq("email", email)
    .maybeSingle();
  sub = existing.data;
  if (!sub) {
    const ins = await supabase
      .from("subscribers")
      .insert({ email })
      .select("id, confirmed, confirm_token, unsubscribe_token")
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

  // Already-confirmed subscriber: it's active immediately, but still send an acknowledgement
  // so they get an email confirming the subscription (not just the on-screen message).
  if (sub.confirmed) {
    await sendEmail({
      to: email,
      ...subscribedEmail({
        billNumber: bill.bill_number,
        billTitle: bill.title,
        billUrl: `${siteUrl()}/bills/${bill.bill_number.toLowerCase()}`,
        unsubscribeUrl: `${siteUrl()}/api/unsubscribe?token=${sub.unsubscribe_token}`,
      }),
      headers: {
        "List-Unsubscribe": `<${siteUrl()}/api/unsubscribe?token=${sub.unsubscribe_token}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    return { ok: true, status: "subscribed" };
  }

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
    .select("id, email")
    .maybeSingle();
  const ok = !error && !!data;

  if (ok && data) {
    // Fire-and-forget: the owner alert is a convenience. A subscriber who has
    // just clicked their confirmation link must see success regardless of
    // whether this send works, so failures are caught and logged, never thrown.
    try {
      await notifyOwnerOfSignup(supabase, data.id, data.email);
    } catch (err) {
      console.error("[subscriptions] owner alert failed; confirmation kept", err);
    }
  }

  return { ok };
}

/**
 * Emails the owner that a subscriber confirmed. Alerts only on confirmation,
 * not on the initial signup: unconfirmed addresses are frequently typos or
 * abandoned, so alerting there would overstate real growth.
 */
async function notifyOwnerOfSignup(
  supabase: SupabaseClient,
  subscriberId: string,
  email: string,
): Promise<void> {
  const owner = process.env.OWNER_NOTIFY_EMAIL;
  if (!owner) return;

  const { data } = await supabase
    .from("subscriptions")
    .select("bills(bill_number, title)")
    .eq("subscriber_id", subscriberId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const bill = (data as { bills?: { bill_number?: string; title?: string } } | null)?.bills;

  await sendEmail({
    to: owner,
    ...ownerSignupAlert({
      email,
      billNumber: bill?.bill_number ?? "a bill",
      billTitle: bill?.title ?? "",
    }),
  });
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
