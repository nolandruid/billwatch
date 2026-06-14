import { createAdminClient } from "@/lib/supabase/admin";
import { unsubscribeByToken } from "@/lib/subscriptions";
import { resultPage } from "@/lib/result-page";

export const dynamic = "force-dynamic";

/** GET /api/unsubscribe?token=… — one-click unsubscribe (CASL) from email footer. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  try {
    const supabase = createAdminClient();
    const { ok } = await unsubscribeByToken(supabase, token);
    return ok
      ? resultPage({
          title: "Unsubscribed",
          message: "You won't receive any more BillWatch emails. You can re-subscribe anytime.",
        })
      : resultPage({
          title: "Link not valid",
          message: "This unsubscribe link is invalid or already used.",
          status: 400,
        });
  } catch {
    return resultPage({
      title: "Something went wrong",
      message: "Please try the link again in a moment.",
      status: 500,
    });
  }
}
