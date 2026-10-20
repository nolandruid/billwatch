import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "@/lib/fake-supabase";
import { digestEmail } from "@/lib/emails";
import {
  digestWindow,
  isDigestDay,
  ottawaDate,
  selectDigestBills,
  sendWeeklyDigest,
  type DigestHistoryRow,
} from "@/lib/digest";

// Monday 2026-09-14 at 13:05 UTC = 9:05am EDT: the digest run. It covers Sep 7-13.
const MONDAY_RUN = new Date("2026-09-14T13:05:00.000Z");
const TUESDAY_RUN = new Date("2026-09-15T13:05:00.000Z");

vi.mock("@/lib/resend", () => ({
  sendEmail: vi.fn(async () => true),
  siteUrl: () => "https://billwatch.ca",
}));

import { sendEmail } from "@/lib/resend";

const sendEmailMock = vi.mocked(sendEmail);

function history(
  overrides: Partial<DigestHistoryRow> & {
    bills: DigestHistoryRow["bills"];
    detected_at: string;
  },
): DigestHistoryRow {
  return {
    status: "Second reading",
    stage: "second_reading_house",
    ...overrides,
  };
}

describe("ottawaDate", () => {
  it("uses the Ottawa calendar date", () => {
    expect(ottawaDate(new Date("2026-09-03T23:00:00.000Z"))).toBe("2026-09-03");
    expect(ottawaDate(new Date("2026-09-04T03:30:00.000Z"))).toBe("2026-09-03");
    expect(ottawaDate(new Date("2026-09-04T04:30:00.000Z"))).toBe("2026-09-04");
  });
});

describe("isDigestDay", () => {
  it("is true only on Monday in Ottawa, in both EDT and EST", () => {
    expect(isDigestDay(MONDAY_RUN)).toBe(true);
    expect(isDigestDay(TUESDAY_RUN)).toBe(false);
    expect(isDigestDay(new Date("2026-12-07T13:05:00.000Z"))).toBe(true); // 8:05am EST Monday
    // 02:00 UTC Monday is still Sunday evening in Ottawa.
    expect(isDigestDay(new Date("2026-09-14T02:00:00.000Z"))).toBe(false);
  });
});

describe("digestWindow", () => {
  it("covers the seven days before the digest date", () => {
    expect(digestWindow("2026-09-14")).toEqual({ from: "2026-09-07", to: "2026-09-13" });
    expect(digestWindow("2027-01-04")).toEqual({ from: "2026-12-28", to: "2027-01-03" });
  });
});

describe("selectDigestBills", () => {
  const c15 = {
    bill_number: "C-15",
    title: "Budget Implementation Act",
    legisinfo_url: "https://www.parl.ca/legisinfo/en/bill/45-1/c-15",
  };
  const s2 = {
    bill_number: "S-2",
    title: "An Act respecting the Senate ethics officer",
    legisinfo_url: "https://www.parl.ca/legisinfo/en/bill/45-1/s-2",
  };
  const c2 = {
    bill_number: "C-2",
    title: "An Act to amend the Criminal Code",
    legisinfo_url: "https://www.parl.ca/legisinfo/en/bill/45-1/c-2",
  };

  it("includes only rows detected in the week before the digest date (Ottawa time)", () => {
    const bills = selectDigestBills(
      [
        // Sunday Sep 6, 11pm EDT: the week before.
        history({ detected_at: "2026-09-07T03:00:00.000Z", status: "Introduced", bills: c15 }),
        // Sunday Sep 13, 11pm EDT: last day of the window.
        history({ detected_at: "2026-09-14T03:00:00.000Z", status: "Royal assent", bills: c2 }),
        // Monday Sep 14, morning: next week's digest.
        history({ detected_at: "2026-09-14T12:00:00.000Z", status: "Introduced", bills: s2 }),
      ],
      "2026-09-14",
    );
    expect(bills.map((b) => b.billNumber)).toEqual(["C-2"]);
    expect(bills[0]?.status).toBe("Royal assent");
  });

  it("keeps the latest status when a bill moved more than once", () => {
    const bills = selectDigestBills(
      [
        history({
          detected_at: "2026-09-08T17:00:00.000Z",
          status: "First reading",
          bills: c15,
        }),
        history({
          detected_at: "2026-09-10T23:00:00.000Z",
          status: "Second reading",
          bills: c15,
        }),
      ],
      "2026-09-14",
    );
    expect(bills).toHaveLength(1);
    expect(bills[0]?.status).toBe("Second reading");
  });

  it("sorts by bill number and unwraps array-shaped joins", () => {
    const bills = selectDigestBills(
      [
        history({ detected_at: "2026-09-08T23:00:00.000Z", bills: [s2] }),
        history({ detected_at: "2026-09-09T23:00:00.000Z", bills: c15 }),
        history({ detected_at: "2026-09-10T23:00:00.000Z", bills: c2 }),
      ],
      "2026-09-14",
    );
    expect(bills.map((b) => b.billNumber)).toEqual(["C-2", "C-15", "S-2"]);
  });

  it("returns an empty list when nothing moved that week", () => {
    expect(
      selectDigestBills(
        [
          history({
            detected_at: "2026-09-01T23:00:00.000Z",
            bills: c15,
          }),
        ],
        "2026-09-14",
      ),
    ).toEqual([]);
  });
});

describe("digestEmail", () => {
  it("links each bill to BillWatch and LEGISinfo", () => {
    const mail = digestEmail({
      weekOf: { from: "2026-09-07", to: "2026-09-13" },
      unsubscribeUrl: "https://billwatch.ca/api/unsubscribe?token=t&list=digest",
      bills: [
        {
          billNumber: "C-2",
          title: "An Act to amend the Criminal Code",
          status: "In committee",
          billUrl: "https://billwatch.ca/bills/c-2",
          legisinfoUrl: "https://www.parl.ca/legisinfo/en/bill/45-1/c-2",
        },
      ],
    });
    expect(mail.subject).toBe("This week in Parliament: C-2 moved");
    expect(mail.text).toContain("from September 7, 2026 to September 13, 2026");
    expect(mail.html).toContain("https://billwatch.ca/bills/c-2");
    expect(mail.html).toContain("https://www.parl.ca/legisinfo/en/bill/45-1/c-2");
    expect(mail.html).toContain("list=digest");
    expect(mail.text).toContain("BillWatch: https://billwatch.ca/bills/c-2");
    expect(mail.text).toContain("LEGISinfo: https://www.parl.ca/legisinfo/en/bill/45-1/c-2");
  });

  it("pluralizes the subject when several bills moved", () => {
    const mail = digestEmail({
      weekOf: { from: "2026-09-07", to: "2026-09-13" },
      unsubscribeUrl: "https://billwatch.ca/api/unsubscribe?token=t&list=digest",
      bills: [
        {
          billNumber: "C-2",
          title: "A",
          status: "Moved",
          billUrl: "https://billwatch.ca/bills/c-2",
          legisinfoUrl: "https://www.parl.ca/legisinfo/en/bill/45-1/c-2",
        },
        {
          billNumber: "S-2",
          title: "B",
          status: "Moved",
          billUrl: "https://billwatch.ca/bills/s-2",
          legisinfoUrl: "https://www.parl.ca/legisinfo/en/bill/45-1/s-2",
        },
      ],
    });
    expect(mail.subject).toBe("This week in Parliament: 2 bills moved");
  });
});

describe("sendWeeklyDigest", () => {
  const billId = "bill-c2";
  const digestSub = {
    id: "sub-digest",
    email: "digest@example.com",
    confirmed: true,
    digest_opt_in: true,
    unsubscribe_token: "unsub-digest",
  };
  const billOnlySub = {
    id: "sub-bill",
    email: "billonly@example.com",
    confirmed: true,
    digest_opt_in: false,
    unsubscribe_token: "unsub-bill",
  };

  beforeEach(() => {
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue(true);
  });

  it("emails opted-in subscribers and skips per-bill-only subscribers", async () => {
    const { from, db } = createFakeSupabase({
      subscribers: [digestSub, billOnlySub],
      bills: [
        {
          id: billId,
          bill_number: "C-2",
          title: "An Act to amend the Criminal Code",
          legisinfo_url: "https://www.parl.ca/legisinfo/en/bill/45-1/c-2",
        },
      ],
      bill_status_history: [
        {
          id: "hist-1",
          bill_id: billId,
          status: "In committee",
          stage: "committee_house",
          detected_at: "2026-09-10T23:00:00.000Z",
        },
      ],
    });

    const result = await sendWeeklyDigest({ from } as never, MONDAY_RUN);

    expect(result).toMatchObject({ digestDate: "2026-09-14", bills: 1, queued: 1, sent: 1 });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const payload = sendEmailMock.mock.calls[0]?.[0];
    expect(payload?.to).toBe("digest@example.com");
    expect(payload?.subject).toBe("This week in Parliament: C-2 moved");
    expect(payload?.html).toContain("/bills/c-2");
    expect(payload?.html).toContain("legisinfo");
    expect(db.digest_outbox).toHaveLength(1);
    expect(db.digest_outbox[0]?.state).toBe("sent");
  });

  it("queues only on Monday", async () => {
    const { from, db } = createFakeSupabase({
      subscribers: [digestSub],
      bills: [
        {
          id: billId,
          bill_number: "C-2",
          title: "An Act to amend the Criminal Code",
          legisinfo_url: "https://www.parl.ca/legisinfo/en/bill/45-1/c-2",
        },
      ],
      bill_status_history: [
        {
          id: "hist-1",
          bill_id: billId,
          status: "In committee",
          stage: "committee_house",
          detected_at: "2026-09-10T17:00:00.000Z",
        },
      ],
    });

    // Tuesday's run only retries; it never queues a new digest.
    const tuesday = await sendWeeklyDigest({ from } as never, TUESDAY_RUN);
    expect(tuesday).toMatchObject({ bills: 0, queued: 0, sent: 0 });
    expect(sendEmailMock).not.toHaveBeenCalled();

    // Monday's run sends it.
    const monday = await sendWeeklyDigest({ from } as never, MONDAY_RUN);
    expect(monday).toMatchObject({ bills: 1, queued: 1, sent: 1 });
    expect(db.digest_outbox).toHaveLength(1);
  });

  it("retries a failed send on the next day's run", async () => {
    const { from, db } = createFakeSupabase({
      subscribers: [digestSub],
      bills: [
        {
          id: billId,
          bill_number: "C-2",
          title: "An Act to amend the Criminal Code",
          legisinfo_url: "https://www.parl.ca/legisinfo/en/bill/45-1/c-2",
        },
      ],
      bill_status_history: [
        {
          id: "hist-1",
          bill_id: billId,
          status: "In committee",
          detected_at: "2026-09-10T23:00:00.000Z",
        },
      ],
    });

    sendEmailMock.mockResolvedValueOnce(false);
    const monday = await sendWeeklyDigest({ from } as never, MONDAY_RUN);
    expect(monday).toMatchObject({ queued: 1, sent: 0, failed: 1 });

    const tuesday = await sendWeeklyDigest({ from } as never, TUESDAY_RUN);
    expect(tuesday).toMatchObject({ queued: 0, sent: 1 });
    // The retry still lists the week the digest was for.
    expect(sendEmailMock.mock.calls[1]?.[0]?.subject).toBe("This week in Parliament: C-2 moved");
    expect(db.digest_outbox[0]?.state).toBe("sent");
  });

  it("does not enqueue or email when no bills changed that week", async () => {
    const { from } = createFakeSupabase({
      subscribers: [digestSub],
      bills: [
        {
          id: billId,
          bill_number: "C-2",
          title: "An Act to amend the Criminal Code",
          legisinfo_url: "https://www.parl.ca/legisinfo/en/bill/45-1/c-2",
        },
      ],
      bill_status_history: [
        {
          id: "hist-old",
          bill_id: billId,
          status: "Introduced",
          detected_at: "2026-09-01T23:00:00.000Z",
        },
      ],
    });

    const result = await sendWeeklyDigest({ from } as never, MONDAY_RUN);
    expect(result).toMatchObject({ bills: 0, queued: 0, sent: 0 });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("is idempotent: a second drain does not send again", async () => {
    const { from } = createFakeSupabase({
      subscribers: [digestSub],
      bills: [
        {
          id: billId,
          bill_number: "C-2",
          title: "An Act to amend the Criminal Code",
          legisinfo_url: "https://www.parl.ca/legisinfo/en/bill/45-1/c-2",
        },
      ],
      bill_status_history: [
        {
          id: "hist-1",
          bill_id: billId,
          status: "In committee",
          detected_at: "2026-09-10T23:00:00.000Z",
        },
      ],
    });
    await sendWeeklyDigest({ from } as never, MONDAY_RUN);
    sendEmailMock.mockClear();
    const again = await sendWeeklyDigest({ from } as never, MONDAY_RUN);
    expect(again.sent).toBe(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("does not call Resend: sendEmail is stubbed", async () => {
    // Guardrail: this suite must never construct the real Resend client.
    expect(process.env.RESEND_API_KEY ?? "").toBe("");
    expect(vi.isMockFunction(sendEmail)).toBe(true);
  });
});
