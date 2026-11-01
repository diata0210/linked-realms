import { expect, it } from "vitest";
import { shortKey } from "./format.ts";
it("shortens a public key for labels", () => {
  expect(shortKey("ab".repeat(32))).toBe("ababab\u2026abab");
});
