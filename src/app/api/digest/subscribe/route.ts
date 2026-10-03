import { createAdminClient } from "@/lib/supabase/admin";
import { subscribeToDigest } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

/**
 * POST { email } → opt into the sitting-end digest (CASL double opt-in).
 * Does not create a per-bill subscription.
 */
export async function POST(request: Request) {
  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  if (!email) {
    return Response.json(
      { ok: false, status: "error", message: "Email is required." },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminClient();
    const result = await subscribeToDigest(supabase, email);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error("[api/digest/subscribe]", err);
    return Response.json({ ok: false, status: "error", message: "Server error." }, { status: 500 });
  }
}
