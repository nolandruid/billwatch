import { describe, expect, it } from "vitest";
import { isToken, maskEmail, parseManageRequest } from "./manage";

const TOKEN = "3f2b6c1e-8d4a-4b7e-9c2f-1a2b3c4d5e6f";
const SUB = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

describe("maskEmail", () => {
  it("keeps the first and last letters and the domain", () => {
    expect(maskEmail("bud.druid@gmail.com")).toBe("b•••d@gmail.com");
  });

  it("hides short local parts", () => {
    expect(maskEmail("ab@example.ca")).toBe("a•••@example.ca");
    expect(maskEmail("a@example.ca")).toBe("a•••@example.ca");
  });

  it("doesn't leak a malformed address", () => {
    expect(maskEmail("nonsense")).toBe("•••");
  });
});

describe("isToken", () => {
  it("accepts UUIDs only", () => {
    expect(isToken(TOKEN)).toBe(true);
    expect(isToken("abc")).toBe(false);
    expect(isToken(undefined)).toBe(false);
  });
});

describe("parseManageRequest", () => {
  it("parses a preference change", () => {
    expect(
      parseManageRequest({ token: TOKEN, subscriptionId: SUB, action: "set", notifyOn: "law" }),
    ).toEqual({ action: "set", token: TOKEN, subscriptionId: SUB, notifyOn: "law" });
  });

  it("parses a removal", () => {
    expect(parseManageRequest({ token: TOKEN, subscriptionId: SUB, action: "remove" })).toEqual({
      action: "remove",
      token: TOKEN,
      subscriptionId: SUB,
    });
  });

  it("rejects bad tokens, preferences and actions", () => {
    expect(parseManageRequest({ token: "x", subscriptionId: SUB, action: "remove" })).toEqual({
      error: "Invalid link.",
    });
    expect(
      parseManageRequest({ token: TOKEN, subscriptionId: SUB, action: "set", notifyOn: "weekly" }),
    ).toEqual({ error: "Invalid notification preference." });
    expect(parseManageRequest({ token: TOKEN, subscriptionId: SUB, action: "delete-all" })).toEqual(
      { error: "Invalid request." },
    );
    expect(parseManageRequest(null)).toEqual({ error: "Invalid request." });
  });
});
