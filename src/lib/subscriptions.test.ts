import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "@/lib/fake-supabase";

vi.mock("@/lib/resend", () => ({
  sendEmail: vi.fn(async () => true),
  siteUrl: () => "https://billwatch.ca",
}));

import { sendEmail } from "@/lib/resend";
import {
  subscribeToBill,
  subscribeToDigest,
  unsubscribeByToken,
  unsubscribeDigestByToken,
} from "@/lib/subscriptions";

const sendEmailMock = vi.mocked(sendEmail);

const bill = {
  id: "bill-c2",
  bill_number: "C-2",
  title: "An Act to amend the Criminal Code",
};

describe("digest opt-in", () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue(true);
  });

  it("does not enroll a per-bill subscriber into the digest", async () => {
    const { from, db } = createFakeSupabase({ bills: [bill] });
    const result = await subscribeToBill({ from } as never, "tracker@example.com", "C-2");
    expect(result).toMatchObject({ ok: true, status: "confirmation_sent" });
    expect(db.subscribers).toHaveLength(1);
    expect(db.subscribers[0]?.digest_opt_in).toBe(false);
    expect(db.subscriptions).toHaveLength(1);
    expect(sendEmailMock.mock.calls[0]?.[0]?.subject).toMatch(/C-2/);
  });

  it("opts in without creating a per-bill subscription", async () => {
    const { from, db } = createFakeSupabase({ bills: [bill] });
    const result = await subscribeToDigest({ from } as never, "digest@example.com");
    expect(result).toMatchObject({ ok: true, status: "confirmation_sent" });
    expect(db.subscribers).toHaveLength(1);
    expect(db.subscribers[0]?.digest_opt_in).toBe(true);
    expect(db.subscribers[0]?.confirmed).toBe(false);
    expect(db.subscriptions).toHaveLength(0);
    expect(sendEmailMock.mock.calls[0]?.[0]?.subject).toMatch(/digest/i);
  });

  it("lets an existing confirmed per-bill subscriber opt in explicitly", async () => {
    const { from, db } = createFakeSupabase({
      bills: [bill],
      subscribers: [
        {
          id: "sub-1",
          email: "both@example.com",
          confirmed: true,
          digest_opt_in: false,
          confirm_token: "c1",
          unsubscribe_token: "u1",
        },
      ],
      subscriptions: [{ id: "subscr-1", subscriber_id: "sub-1", bill_id: bill.id }],
    });

    const result = await subscribeToDigest({ from } as never, "both@example.com");
    expect(result).toMatchObject({ ok: true, status: "subscribed" });
    expect(db.subscribers[0]?.digest_opt_in).toBe(true);
    expect(db.subscriptions).toHaveLength(1);
    expect(sendEmailMock.mock.calls[0]?.[0]?.subject).toMatch(/digest/i);
  });

  it("digest unsubscribe leaves per-bill subscriptions in place", async () => {
    const { from, db } = createFakeSupabase({
      bills: [bill],
      subscribers: [
        {
          id: "sub-1",
          email: "both@example.com",
          confirmed: true,
          digest_opt_in: true,
          unsubscribe_token: "u1",
        },
      ],
      subscriptions: [{ id: "subscr-1", subscriber_id: "sub-1", bill_id: bill.id }],
    });

    const result = await unsubscribeDigestByToken({ from } as never, "u1");
    expect(result.ok).toBe(true);
    expect(db.subscribers).toHaveLength(1);
    expect(db.subscribers[0]?.digest_opt_in).toBe(false);
    expect(db.subscriptions).toHaveLength(1);
  });

  it("full unsubscribe still deletes the subscriber", async () => {
    const { from, db } = createFakeSupabase({
      subscribers: [
        {
          id: "sub-1",
          email: "gone@example.com",
          confirmed: true,
          digest_opt_in: true,
          unsubscribe_token: "u-all",
        },
      ],
      subscriptions: [{ id: "subscr-1", subscriber_id: "sub-1", bill_id: bill.id }],
    });

    const result = await unsubscribeByToken({ from } as never, "u-all");
    expect(result.ok).toBe(true);
    expect(db.subscribers).toHaveLength(0);
    expect(db.subscriptions).toHaveLength(0);
  });

  it("rejects an invalid address without writing a row", async () => {
    const { from, db } = createFakeSupabase();
    const result = await subscribeToDigest({ from } as never, "not-an-email");
    expect(result.ok).toBe(false);
    expect(db.subscribers).toHaveLength(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
