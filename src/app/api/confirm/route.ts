import { createAdminClient } from "@/lib/supabase/admin";
import { confirmSubscriber } from "@/lib/subscriptions";
import { resultPage } from "@/lib/result-page";

export const dynamic = "force-dynamic";

/** GET /api/confirm?token=… — double-opt-in confirmation landing (clicked from email). */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  try {
    const supabase = createAdminClient();
    const { ok } = await confirmSubscriber(supabase, token);
    return ok
      ? resultPage({
          title: "You're all set ✓",
          message:
            "Your email is confirmed. We'll let you know each time a bill you're tracking changes status.",
        })
      : resultPage({
          title: "Link not valid",
          message:
            "This confirmation link is invalid or already used. Try subscribing again from the bill page.",
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
