/**
 * Feedback proxy. The browser posts here; we forward to Discord server-side so the
 * webhook URL never reaches the client bundle. Degrades gracefully if no webhook is
 * configured (useful in local/dev) by accepting the message without forwarding.
 */
export const dynamic = "force-dynamic";

const MAX_MESSAGE = 300;

export async function POST(request: Request) {
  let body: { message?: unknown; email?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";

  if (!message) {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE) {
    return Response.json({ error: "Message too long" }, { status: 400 });
  }

  const webhook = process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
  if (!webhook) {
    // No webhook configured (e.g. local dev). Accept but don't forward.
    console.warn("[feedback] DISCORD_FEEDBACK_WEBHOOK_URL not set; message not forwarded.");
    return Response.json({ ok: true, forwarded: false });
  }

  const content = [
    "**New BillWatch feedback**",
    email ? `From: ${email}` : "From: (anonymous)",
    "",
    message,
  ].join("\n");

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.slice(0, MAX_MESSAGE) }),
    });
    if (!res.ok) throw new Error(`Discord responded ${res.status}`);
    return Response.json({ ok: true, forwarded: true });
  } catch (err) {
    console.error("[feedback] failed to forward:", err);
    return Response.json({ error: "Failed to send feedback" }, { status: 502 });
  }
}
