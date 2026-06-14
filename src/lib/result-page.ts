import { siteUrl } from "@/lib/resend";

/** A small, self-contained branded HTML page for confirm/unsubscribe link landings. */
export function resultPage(opts: { title: string; message: string; status?: number }): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${opts.title} · BillWatch</title></head>
  <body style="margin:0;background:#f4f2f3;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#232b26;">
    <div style="max-width:480px;margin:12vh auto;padding:24px;text-align:center;">
      <div style="font-weight:700;font-size:22px;color:#265c3a;letter-spacing:-0.02em;">BillWatch</div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:28px;margin-top:16px;">
        <h1 style="font-size:20px;margin:0 0 8px;">${opts.title}</h1>
        <p style="margin:0 0 20px;color:#4b5563;line-height:1.6;">${opts.message}</p>
        <a href="${siteUrl()}" style="display:inline-block;background:#265c3a;color:#fff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:10px;">Go to BillWatch</a>
      </div>
    </div>
  </body></html>`;
  return new Response(html, {
    status: opts.status ?? 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
