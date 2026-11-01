import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { TEST_LAND_KEY, TEST_PLAYER_KEY } from "@linked-realms/shared";
import { loadConfig } from "./config.ts";
it("loads local world defaults with an empty environment", () => {
  expect(loadConfig({})).toMatchObject({
    port: 2567,
    host: "127.0.0.1",
    ownerPlayerKey: TEST_PLAYER_KEY,
    adjacency: { version: 1, landKey: TEST_LAND_KEY, neighbors: {} },
  });
});
it("loads the shared fixture as LAND_ADJACENCY_FILE", () => {
  const path = fileURLToPath(
    new URL("../../shared/fixtures/two-lands/land-a.json", import.meta.url),
  );
  expect(
    loadConfig({ LAND_ADJACENCY_FILE: path }).adjacency.neighbors.east,
  ).toBe("bb".repeat(32));
});
it.each([
  { NODE_ENV: "production" },
  { HOST: "0.0.0.0" },
  { LAND_COLYSEUS_PORT: "0" },
  { LAND_COLYSEUS_PORT: "65536" },
  { LAND_COLYSEUS_PORT: "1.5" },
  { LAND_OWNER_PLAYER_KEY: "0x1234" },
])("fails before listening with %j", (env) => {
  expect(() => loadConfig(env)).toThrow();
});
it("rejects duplicate, malformed and oversized config files", () => {
  const dir = mkdtempSync(join(tmpdir(), "g1-adjacency-"));
  try {
    const path = join(dir, "land.json");
    for (const text of [
      "{}",
      " ".repeat(2049),
      `{"version":2,"version":1,"landKey":"${TEST_LAND_KEY}","neighbors":{}}`,
    ]) {
      writeFileSync(path, text);
      expect(() => loadConfig({ LAND_ADJACENCY_FILE: path })).toThrow();
    }
  } finally {
    rmSync(dir, { recursive: true });
  }
});

it("isolates the default data directory by Land key and accepts an explicit directory", () => {
  const own = loadConfig({});
  expect(own.dataDir).toContain(TEST_LAND_KEY);
  expect(loadConfig({ LAND_DATA_DIR: "custom-land-data" }).dataDir).toBe(
    resolve("custom-land-data"),
  );
});
