import { createAdminClient } from "@/lib/supabase/admin";
import { unsubscribeByToken } from "@/lib/subscriptions";
import { isToken, manageUrl, unsubscribeFromBill } from "@/lib/manage";
import { resultPage } from "@/lib/result-page";

export const dynamic = "force-dynamic";

/**
 * Unsubscribe links (CASL).
 *   ?token=…&bill=<bill id>  stop one bill: the "Unsubscribe" link in that bill's emails.
 *   ?token=…                 stop everything: "Unsubscribe from all" on the manage page.
 * GET is a click from the email; POST is a mail client's one-click unsubscribe (RFC 8058,
 * the List-Unsubscribe-Post header), which must not need a page visit.
 */
async function handle(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const token = params.get("token");
  const billId = params.get("bill");
  if (!isToken(token) || (billId !== null && !isToken(billId))) return invalid();
  try {
    const supabase = createAdminClient();
    if (billId) {
      const { ok, billNumber } = await unsubscribeFromBill(supabase, token, billId);
      return ok
        ? resultPage({
            title: `Unsubscribed from ${billNumber ?? "that bill"}`,
            message:
              `You won't get any more emails about ${billNumber ?? "that bill"}. ` +
              `Your other bills are unchanged: <a href="${manageUrl(token)}" ` +
              `style="color:#265c3a;">manage your subscriptions</a> to change them or ` +
              "unsubscribe from everything.",
          })
        : invalid();
    }
    const { ok } = await unsubscribeByToken(supabase, token);
    return ok
      ? resultPage({
          title: "Unsubscribed",
          message: "You won't receive any more BillWatch emails. You can re-subscribe anytime.",
        })
      : invalid();
  } catch {
    return resultPage({
      title: "Something went wrong",
      message: "Please try the link again in a moment.",
      status: 500,
    });
  }
}

function invalid(): Response {
  return resultPage({
    title: "Link not valid",
    message: "This unsubscribe link is invalid or already used.",
    status: 400,
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
