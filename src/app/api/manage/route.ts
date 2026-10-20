import { createAdminClient } from "@/lib/supabase/admin";
import { applyManageAction, parseManageRequest } from "@/lib/manage";

export const dynamic = "force-dynamic";

/**
 * POST { token, subscriptionId, action: "set", notifyOn } → change a bill's preference.
 * POST { token, subscriptionId, action: "remove" } → stop tracking that one bill.
 * `token` is the subscriber's unsubscribe token from their manage link.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }
  const req = parseManageRequest(body);
  if ("error" in req) return Response.json({ ok: false, message: req.error }, { status: 400 });

  try {
    const { ok } = await applyManageAction(createAdminClient(), req);
    return ok
      ? Response.json({ ok: true })
      : Response.json(
          { ok: false, message: "That subscription no longer exists." },
          { status: 404 },
        );
  } catch (err) {
    console.error("[api/manage]", err);
    return Response.json({ ok: false, message: "Server error." }, { status: 500 });
  }
}
