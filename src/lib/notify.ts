import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, siteUrl } from "@/lib/resend";
import { notificationEmail } from "@/lib/emails";

const MAX_ATTEMPTS = 3;

interface OutboxRow {
  id: string;
  attempts: number;
  subscribers: { email: string; unsubscribe_token: string };
  bills: { bill_number: string; title: string };
  bill_status_history: { status: string | null };
}

/**
 * Drain pending notifications: email each confirmed subscriber whose bill changed, then mark
 * the row sent (or failed after MAX_ATTEMPTS). The outbox is populated by the sync job, so this
 * just turns queued change-events into delivered email. Safe to run repeatedly.
 */
export async function drainOutbox(
  supabase: SupabaseClient,
  limit = 200,
): Promise<{ sent: number; failed: number }> {
  const { data, error } = await supabase
    .from("notifications_outbox")
    .select(
      "id, attempts, subscribers!inner(email, unsubscribe_token), bills!inner(bill_number, title), bill_status_history!inner(status)",
    )
    .eq("state", "pending")
    .limit(limit);
  if (error || !data) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  for (const row of data as unknown as OutboxRow[]) {
    const { email, unsubscribe_token } = row.subscribers;
    const { bill_number, title } = row.bills;
    const status = row.bill_status_history?.status ?? "Status updated";
    const billUrl = `${siteUrl()}/bills/${bill_number.toLowerCase()}`;
    const unsubscribeUrl = `${siteUrl()}/api/unsubscribe?token=${unsubscribe_token}`;

    const ok = await sendEmail({
      to: email,
      ...notificationEmail({
        billNumber: bill_number,
        billTitle: title,
        status,
        billUrl,
        unsubscribeUrl,
      }),
      // Gmail/Outlook one-click unsubscribe.
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    if (ok) {
      await supabase
        .from("notifications_outbox")
        .update({ state: "sent", sent_at: new Date().toISOString() })
        .eq("id", row.id);
      sent += 1;
    } else {
      const attempts = row.attempts + 1;
      await supabase
        .from("notifications_outbox")
        .update({
          state: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          attempts,
          last_error: "email send failed",
        })
        .eq("id", row.id);
      failed += 1;
    }
  }
  return { sent, failed };
}
