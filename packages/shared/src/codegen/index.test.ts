import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { outputs, renderEmptyLand } from "./index.ts";
it("keeps the local default map in sync with shared rules", () => {
  expect(readFileSync(outputs.emptyLand, "utf8").replace(/\r\n/g, "\n")).toBe(
    renderEmptyLand(),
  );
});
