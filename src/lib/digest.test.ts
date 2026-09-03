import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "@/lib/fake-supabase";
import { digestEmail } from "@/lib/emails";
import {
  selectDigestBills,
  sittingDateInOttawa,
  sendSittingDigest,
  type DigestHistoryRow,
} from "@/lib/digest";

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

describe("sittingDateInOttawa", () => {
  it("keeps 23:00 UTC on the same Ottawa calendar day (evening cron)", () => {
    // 23:00 UTC is 18:00 EST / 19:00 EDT, still that date in America/Toronto.
    expect(sittingDateInOttawa(new Date("2026-09-03T23:00:00.000Z"))).toBe("2026-09-03");
    expect(sittingDateInOttawa(new Date("2026-01-15T23:00:00.000Z"))).toBe("2026-01-15");
  });

  it("rolls to the next Ottawa day after midnight Eastern", () => {
    expect(sittingDateInOttawa(new Date("2026-09-04T04:30:00.000Z"))).toBe("2026-09-04");
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

  it("includes only rows detected on the Ottawa sitting date", () => {
    const bills = selectDigestBills(
      [
        history({
          detected_at: "2026-09-02T23:00:00.000Z",
          status: "Introduced",
          bills: c15,
        }),
        history({
          detected_at: "2026-09-03T23:00:00.000Z",
          status: "Royal assent",
          bills: c2,
        }),
      ],
      "2026-09-03",
    );
    expect(bills.map((b) => b.billNumber)).toEqual(["C-2"]);
    expect(bills[0]?.status).toBe("Royal assent");
  });

  it("keeps the latest status when a bill moved more than once", () => {
    const bills = selectDigestBills(
      [
        history({
          detected_at: "2026-09-03T12:00:00.000Z",
          status: "First reading",
          bills: c15,
        }),
        history({
          detected_at: "2026-09-03T23:00:00.000Z",
          status: "Second reading",
          bills: c15,
        }),
      ],
      "2026-09-03",
    );
    expect(bills).toHaveLength(1);
    expect(bills[0]?.status).toBe("Second reading");
  });

  it("sorts by bill number and unwraps array-shaped joins", () => {
    const bills = selectDigestBills(
      [
        history({ detected_at: "2026-09-03T23:00:00.000Z", bills: [s2] }),
        history({ detected_at: "2026-09-03T23:00:00.000Z", bills: c15 }),
        history({ detected_at: "2026-09-03T23:00:00.000Z", bills: c2 }),
      ],
      "2026-09-03",
    );
    expect(bills.map((b) => b.billNumber)).toEqual(["C-2", "C-15", "S-2"]);
  });

  it("returns an empty list when nothing moved that day", () => {
    expect(
      selectDigestBills(
        [
          history({
            detected_at: "2026-09-01T23:00:00.000Z",
            bills: c15,
          }),
        ],
        "2026-09-03",
      ),
    ).toEqual([]);
  });
});

describe("digestEmail", () => {
  it("links each bill to BillWatch and LEGISinfo", () => {
    const mail = digestEmail({
      sittingDate: "2026-09-03",
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
    expect(mail.subject).toBe("C-2 changed status today");
    expect(mail.html).toContain("https://billwatch.ca/bills/c-2");
    expect(mail.html).toContain("https://www.parl.ca/legisinfo/en/bill/45-1/c-2");
    expect(mail.html).toContain("list=digest");
    expect(mail.text).toContain("BillWatch: https://billwatch.ca/bills/c-2");
    expect(mail.text).toContain("LEGISinfo: https://www.parl.ca/legisinfo/en/bill/45-1/c-2");
  });

  it("pluralizes the subject when several bills moved", () => {
    const mail = digestEmail({
      sittingDate: "2026-09-03",
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
    expect(mail.subject).toBe("2 bills changed status today");
  });
});

describe("sendSittingDigest", () => {
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
          detected_at: "2026-09-03T23:00:00.000Z",
        },
      ],
    });

    const result = await sendSittingDigest({ from } as never, new Date("2026-09-03T23:05:00.000Z"));

    expect(result).toMatchObject({ sittingDate: "2026-09-03", bills: 1, queued: 1, sent: 1 });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const payload = sendEmailMock.mock.calls[0]?.[0];
    expect(payload?.to).toBe("digest@example.com");
    expect(payload?.subject).toBe("C-2 changed status today");
    expect(payload?.html).toContain("/bills/c-2");
    expect(payload?.html).toContain("legisinfo");
    expect(db.digest_outbox).toHaveLength(1);
    expect(db.digest_outbox[0]?.state).toBe("sent");
  });

  it("does not enqueue or email when no bills changed that sitting day", async () => {
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

    const result = await sendSittingDigest({ from } as never, new Date("2026-09-03T23:00:00.000Z"));
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
          detected_at: "2026-09-03T23:00:00.000Z",
        },
      ],
    });
    const now = new Date("2026-09-03T23:05:00.000Z");
    await sendSittingDigest({ from } as never, now);
    sendEmailMock.mockClear();
    const again = await sendSittingDigest({ from } as never, now);
    expect(again.sent).toBe(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("does not call Resend: sendEmail is stubbed", async () => {
    // Guardrail: this suite must never construct the real Resend client.
    expect(process.env.RESEND_API_KEY ?? "").toBe("");
    expect(vi.isMockFunction(sendEmail)).toBe(true);
  });
});
