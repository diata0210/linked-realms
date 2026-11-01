import { expect, it } from "vitest";
import { unavailableGold } from "./gold.ts";

it("never fabricates a balance or approves a spend without the chain", async () => {
  const key = "ab".repeat(32);
  expect(await unavailableGold.balance(key)).toEqual({ status: "unavailable" });
  await expect(unavailableGold.spend(key, 1n, "test-spend")).rejects.toThrow(
    "unavailable",
  );
  expect(await unavailableGold.balance(key)).toEqual({ status: "unavailable" });
});
