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
  /** Set for subscribers not yet on the digest, to offer it. Null hides the line. */
  digestSignupUrl?: string | null;
}): { subject: string; html: string; text: string } {
  const { billNumber, billTitle, status, billUrl, unsubscribeUrl, digestSignupUrl } = opts;
  const subject = `${billNumber} just changed status`;
  const html = layout(
    `<p style="margin:0 0 8px;font-size:13px;color:#6b7280;">${billNumber} &middot; ${escapeHtml(
      billTitle,
    )}</p>
     <p style="margin:0 0 16px;font-size:18px;font-weight:600;">${escapeHtml(status)}</p>
     <a href="${billUrl}" style="display:inline-block;background:${BRAND};color:#fff;
       text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px;">
       View ${billNumber} on BillWatch</a>${
         digestSignupUrl
           ? `
     <p style="margin:20px 0 0;font-size:14px;color:#4b5563;">Want every bill that moved, in one
       email every Monday morning? <a href="${digestSignupUrl}" style="color:${BRAND};">Get the
       weekly digest</a>.</p>`
           : ""
       }`,
    `You're getting this because you subscribed to ${billNumber} on billwatch.ca.
     <a href="${unsubscribeUrl}" style="color:#6b7280;">Unsubscribe</a>.
     BillWatch is an independent, open-source project, not affiliated with the Government of Canada.`,
  );
  const text = `${billNumber} (${billTitle}) changed status:
${status}

View on BillWatch: ${billUrl}
${
  digestSignupUrl
    ? `
Want every bill that moved, in one email every Monday morning? Get the weekly digest: ${digestSignupUrl}
`
    : ""
}
Unsubscribe: ${unsubscribeUrl}
BillWatch is independent and not affiliated with the Government of Canada.`;
  return { subject, html, text };
}

export function subscribedEmail(opts: {
  billNumber: string;
  billTitle: string;
  billUrl: string;
  unsubscribeUrl: string;
}): { subject: string; html: string; text: string } {
  const { billNumber, billTitle, billUrl, unsubscribeUrl } = opts;
  const subject = `You're now tracking ${billNumber}`;
  const html = layout(
    `<p style="margin:0 0 16px;">You're now tracking <strong>${billNumber}</strong> &mdash;
      ${escapeHtml(billTitle)}. We'll email you each time it changes status.</p>
     <a href="${billUrl}" style="display:inline-block;background:${BRAND};color:#fff;
       text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px;">
       View ${billNumber} on BillWatch</a>`,
    `You subscribed on billwatch.ca.
     <a href="${unsubscribeUrl}" style="color:#6b7280;">Unsubscribe</a>.
     BillWatch is an independent, open-source project, not affiliated with the Government of Canada.`,
  );
  const text = `You're now tracking ${billNumber} (${billTitle}). We'll email you each time it changes status.

View on BillWatch: ${billUrl}

Unsubscribe: ${unsubscribeUrl}
BillWatch is independent and not affiliated with the Government of Canada.`;
  return { subject, html, text };
}

export function digestConfirmationEmail(opts: { confirmUrl: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const { confirmUrl } = opts;
  const subject = "Confirm your BillWatch weekly digest";
  const html = layout(
    `<p style="margin:0 0 12px;">Please confirm you want one email every Monday morning, listing
      every federal bill that changed status the week before.</p>
     <p style="margin:0 0 20px;">We only send mail after you confirm. This is separate from
      per-bill alerts.</p>
     <a href="${confirmUrl}" style="display:inline-block;background:${ACCENT};color:#fff;
       text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px;">
       Confirm the digest</a>
     <p style="margin:20px 0 0;font-size:13px;color:#6b7280;">Or paste this link:<br>
       <a href="${confirmUrl}" style="color:${BRAND};">${confirmUrl}</a></p>`,
    `You received this because someone entered this address on billwatch.ca for the weekly
     digest. If that wasn't you, ignore this email and nothing happens. BillWatch is an
     independent, open-source project, not affiliated with the Government of Canada.`,
  );
  const text = `Confirm your BillWatch weekly digest.
We only send mail after you confirm:
${confirmUrl}

If that wasn't you, ignore this email. BillWatch is independent and not affiliated with the Government of Canada.`;
  return { subject, html, text };
}

export function digestSubscribedEmail(opts: { unsubscribeUrl: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const { unsubscribeUrl } = opts;
  const subject = "You're on the BillWatch weekly digest";
  const html = layout(
    `<p style="margin:0 0 16px;">You're on the weekly digest. Every Monday morning we'll send one
      email listing every federal bill that changed status the week before, with links to
      BillWatch and LEGISinfo.</p>
     <p style="margin:0;font-size:13px;color:#6b7280;">This does not change any per-bill alerts
      you already have.</p>`,
    `You subscribed on billwatch.ca.
     <a href="${unsubscribeUrl}" style="color:#6b7280;">Unsubscribe from the digest</a>.
     BillWatch is an independent, open-source project, not affiliated with the Government of Canada.`,
  );
  const text = `You're on the BillWatch weekly digest. Every Monday morning we'll send one email listing every federal bill that changed status the week before.

Unsubscribe: ${unsubscribeUrl}
BillWatch is independent and not affiliated with the Government of Canada.`;
  return { subject, html, text };
}

export function digestEmail(opts: {
  /** The Ottawa dates covered, inclusive (YYYY-MM-DD). */
  weekOf: { from: string; to: string };
  unsubscribeUrl: string;
  bills: Array<{
    billNumber: string;
    title: string;
    status: string;
    billUrl: string;
    legisinfoUrl: string;
  }>;
}): { subject: string; html: string; text: string } {
  const { weekOf, unsubscribeUrl, bills } = opts;
  const n = bills.length;
  const subject =
    n === 1
      ? `This week in Parliament: ${bills[0].billNumber} moved`
      : `This week in Parliament: ${n} bills moved`;
  const dateLabel = `${formatDate(weekOf.from)} to ${formatDate(weekOf.to)}`;
  const itemsHtml = bills
    .map(
      (bill) =>
        `<li style="margin:0 0 16px;">
          <div style="font-weight:700;">${escapeHtml(bill.billNumber)}</div>
          <div style="color:#4b5563;">${escapeHtml(bill.title)}</div>
          <div style="margin:4px 0 8px;font-weight:600;">${escapeHtml(bill.status)}</div>
          <a href="${bill.billUrl}" style="color:${BRAND};">BillWatch</a>
          &nbsp;&middot;&nbsp;
          <a href="${bill.legisinfoUrl}" style="color:${BRAND};">LEGISinfo</a>
        </li>`,
    )
    .join("");
  const html = layout(
    `<p style="margin:0 0 16px;">Here's what moved in Parliament from ${escapeHtml(dateLabel)}.</p>
     <ul style="margin:0;padding-left:18px;">${itemsHtml}</ul>`,
    `You're getting this because you subscribed to the weekly digest on billwatch.ca.
     <a href="${unsubscribeUrl}" style="color:#6b7280;">Unsubscribe from the digest</a>.
     Per-bill alerts are unchanged. BillWatch is an independent, open-source project, not
     affiliated with the Government of Canada.`,
  );
  const itemsText = bills
    .map(
      (bill) =>
        `${bill.billNumber}: ${bill.title}\n${bill.status}\nBillWatch: ${bill.billUrl}\nLEGISinfo: ${bill.legisinfoUrl}`,
    )
    .join("\n\n");
  const text = `Here's what moved in Parliament from ${dateLabel}.

${itemsText}

Unsubscribe: ${unsubscribeUrl}
Per-bill alerts are unchanged. BillWatch is independent and not affiliated with the Government of Canada.`;
  return { subject, html, text };
}

/**
 * Tells the site owner a subscriber confirmed. Deliberately plain text and
 * unstyled: it is an internal signal, not a customer-facing email.
 */
export function ownerSignupAlert(opts: {
  email: string;
  billNumber?: string;
  billTitle?: string;
  digest?: boolean;
}): {
  subject: string;
  html: string;
  text: string;
} {
  const { email, billNumber, billTitle, digest } = opts;
  if (digest && !billNumber) {
    const subject = "New BillWatch digest subscriber";
    const text = `${email} confirmed and joined the weekly digest.`;
    const html = `<p>${escapeHtml(email)} confirmed and joined the weekly digest.</p>`;
    return { subject, html, text };
  }
  const number = billNumber ?? "a bill";
  const subject = `New BillWatch subscriber: ${number}`;
  const text = `${email} confirmed and is now tracking ${number}.\n\n${billTitle ?? ""}`;
  const html = `<p>${escapeHtml(email)} confirmed and is now tracking <strong>${escapeHtml(
    number,
  )}</strong>.</p><p>${escapeHtml(billTitle ?? "")}</p>`;
  return { subject, html, text };
}

function formatDate(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return ymd;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-CA", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
