import { describe, expect, it } from "vitest";
import { notificationEmail } from "./emails";

const base = {
  billNumber: "C-15",
  billTitle: "Budget 2025 Implementation Act, No. 1",
  status: "At consideration in committee",
  billUrl: "https://billwatch.ca/bills/c-15",
  unsubscribeUrl: "https://billwatch.ca/api/unsubscribe?token=t",
};

describe("notificationEmail digest offer", () => {
  it("offers the digest when given a signup link", () => {
    const { html, text } = notificationEmail({
      ...base,
      digestSignupUrl: "https://billwatch.ca/#digest",
    });
    expect(html).toContain('href="https://billwatch.ca/#digest"');
    expect(text).toContain("Get the sitting-end digest: https://billwatch.ca/#digest");
  });

  it("leaves it out for subscribers already on the digest", () => {
    const { html, text } = notificationEmail({ ...base, digestSignupUrl: null });
    expect(html).not.toContain("digest");
    expect(text).not.toContain("digest");
    expect(text).toContain("View on BillWatch: https://billwatch.ca/bills/c-15\n\nUnsubscribe:");
  });
});
