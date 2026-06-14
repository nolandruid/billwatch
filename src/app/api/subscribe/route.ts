import { createAdminClient } from "@/lib/supabase/admin";
import { subscribeToBill } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

/**
 * POST { email, billNumber } → start (double-opt-in) tracking a bill.
 * Returns { ok, status, message } where status is confirmation_sent | subscribed | error.
 */
export async function POST(request: Request) {
  let body: { email?: unknown; billNumber?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  const billNumber = typeof body.billNumber === "string" ? body.billNumber : "";
  if (!email || !billNumber) {
    return Response.json(
      { ok: false, status: "error", message: "Email and bill are required." },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminClient();
    const result = await subscribeToBill(supabase, email, billNumber);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    console.error("[api/subscribe]", err);
    return Response.json({ ok: false, status: "error", message: "Server error." }, { status: 500 });
  }
}
