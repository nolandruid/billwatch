/**
 * Email templates. Plain, accessible HTML with a matching text/plain part. Every email
 * identifies the sender and (for ongoing mail) carries a one-click unsubscribe link, per CASL.
 */

const BRAND = "#265c3a"; // House-of-Commons green
const ACCENT = "#d6336c"; // cerise

function layout(bodyHtml: string, footerHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f2f3;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#232b26;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="font-weight:700;font-size:20px;color:${BRAND};letter-spacing:-0.02em;">BillWatch</div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:24px;margin-top:16px;line-height:1.6;">
      ${bodyHtml}
    </div>
    <div style="color:#8b8b8b;font-size:12px;line-height:1.6;margin-top:16px;">${footerHtml}</div>
  </div></body></html>`;
}

export function confirmationEmail(opts: {
  billNumber: string;
  billTitle: string;
  confirmUrl: string;
}): { subject: string; html: string; text: string } {
  const { billNumber, billTitle, confirmUrl } = opts;
  const subject = `Confirm your BillWatch alerts for ${billNumber}`;
  const html = layout(
    `<p style="margin:0 0 12px;">Please confirm you want email alerts when
      <strong>${billNumber}</strong> &mdash; ${escapeHtml(billTitle)} &mdash; changes status.</p>
     <p style="margin:0 0 20px;">We only send mail after you confirm.</p>
     <a href="${confirmUrl}" style="display:inline-block;background:${ACCENT};color:#fff;
       text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px;">
       Confirm my alerts</a>
     <p style="margin:20px 0 0;font-size:13px;color:#6b7280;">Or paste this link:<br>
       <a href="${confirmUrl}" style="color:${BRAND};">${confirmUrl}</a></p>`,
    `You received this because someone entered this address on billwatch.ca to track ${billNumber}.
     If that wasn't you, ignore this email and nothing happens. BillWatch is an independent,
     open-source project, not affiliated with the Government of Canada.`,
  );
  const text = `Confirm your BillWatch alerts for ${billNumber} (${billTitle}).
We only send mail after you confirm:
${confirmUrl}

If that wasn't you, ignore this email. BillWatch is independent and not affiliated with the Government of Canada.`;
  return { subject, html, text };
}

export function notificationEmail(opts: {
  billNumber: string;
  billTitle: string;
  status: string;
  billUrl: string;
  unsubscribeUrl: string;
}): { subject: string; html: string; text: string } {
  const { billNumber, billTitle, status, billUrl, unsubscribeUrl } = opts;
  const subject = `${billNumber} just changed status`;
  const html = layout(
    `<p style="margin:0 0 8px;font-size:13px;color:#6b7280;">${billNumber} &middot; ${escapeHtml(
      billTitle,
    )}</p>
     <p style="margin:0 0 16px;font-size:18px;font-weight:600;">${escapeHtml(status)}</p>
     <a href="${billUrl}" style="display:inline-block;background:${BRAND};color:#fff;
       text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px;">
       View ${billNumber} on BillWatch</a>`,
    `You're getting this because you subscribed to ${billNumber} on billwatch.ca.
     <a href="${unsubscribeUrl}" style="color:#6b7280;">Unsubscribe</a>.
     BillWatch is an independent, open-source project, not affiliated with the Government of Canada.`,
  );
  const text = `${billNumber} (${billTitle}) changed status:
${status}

View on BillWatch: ${billUrl}

Unsubscribe: ${unsubscribeUrl}
BillWatch is independent and not affiliated with the Government of Canada.`;
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
