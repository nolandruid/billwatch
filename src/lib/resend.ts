import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM || "BillWatch <notify@billwatch.ca>";

/** Public base URL, used to build confirm/unsubscribe links in emails. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

let client: Resend | null = null;
function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

/**
 * Send one transactional email. Returns true on success. If RESEND_API_KEY is unset (e.g. a
 * preview env without secrets), this is a graceful no-op so the rest of the flow still works.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
}): Promise<boolean> {
  const resend = getClient();
  if (!resend) {
    // Don't log the recipient address (PII).
    console.warn("[email] RESEND_API_KEY not set; skipping send.");
    return false;
  }
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      headers: opts.headers,
    });
    if (error) {
      console.error("[email] send failed:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] send threw:", err);
    return false;
  }
}
