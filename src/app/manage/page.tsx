import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getManageView, type ManageView } from "@/lib/manage";
import { ManageSubscriptions } from "@/components/manage-subscriptions";

export const dynamic = "force-dynamic";

// The URL carries the subscriber's token: keep it out of search engines and Referer headers.
export const metadata: Metadata = {
  title: "Manage subscriptions",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ManagePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).token;
  const token = typeof raw === "string" ? raw : "";

  let view: ManageView | null = null;
  let failed = false;
  try {
    view = token ? await getManageView(createAdminClient(), token) : null;
  } catch (err) {
    console.error("[manage]", err);
    failed = true;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 pb-20">
      <h1 className="font-display text-brand-darker text-3xl font-semibold tracking-tight">
        Manage subscriptions
      </h1>
      {failed ? (
        <p className="text-foreground/70 mt-4">
          Something went wrong loading your subscriptions. Please try the link again in a moment.
        </p>
      ) : !view ? (
        <p className="text-foreground/70 mt-4">
          This link is invalid or you&apos;ve already unsubscribed. Use the &ldquo;Manage
          subscriptions&rdquo; link in any recent BillWatch email, or{" "}
          <Link href="/" className="text-brand underline underline-offset-2">
            subscribe to a bill
          </Link>
          .
        </p>
      ) : (
        <ManageSubscriptions token={token} view={view} />
      )}
    </div>
  );
}
