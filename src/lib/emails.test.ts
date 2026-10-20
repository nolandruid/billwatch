import { describe, expect, it } from "vitest";
import { notificationEmail } from "./emails";

describe("notificationEmail", () => {
  const email = notificationEmail({
    billNumber: "C-15",
    billTitle: "Budget 2025 Implementation Act, No. 1",
    status: "At consideration in committee",
    billUrl: "https://billwatch.ca/bills/c-15",
    manageUrl: "https://billwatch.ca/manage?token=t",
    unsubscribeUrl: "https://billwatch.ca/api/unsubscribe?token=t&bill=b",
  });

  it("always points to the per-bill preference", () => {
    expect(email.html).toContain(
      'href="https://billwatch.ca/manage?token=t" style="color:#265c3a;">Choose which changes email you',
    );
    expect(email.text).toContain(
      "Choose which changes email you: https://billwatch.ca/manage?token=t",
    );
  });

  it("unsubscribes from this bill, with Manage for everything else", () => {
    expect(email.text).toContain(
      "Unsubscribe from C-15: https://billwatch.ca/api/unsubscribe?token=t&bill=b",
    );
    expect(email.text).toContain("Manage subscriptions: https://billwatch.ca/manage?token=t");
    expect(email.html).toContain(">Unsubscribe from C-15</a>");
  });
});
