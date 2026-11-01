import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  isAgentKey,
  localTestAdjacency,
  MAX_ADJACENCY_BYTES,
  parseAdjacencyJson,
  TEST_PLAYER_KEY,
  type AgentKey,
  type LandAdjacency,
} from "@linked-realms/shared";
export interface Config {
  port: number;
  host: "127.0.0.1";
  mapFile: string;
  dataDir: string;
  ownerPlayerKey: AgentKey;
  adjacency: LandAdjacency;
}
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (env.NODE_ENV === "production")
    throw new Error(
      "The agent-key test adapter cannot run in production; G4 admission is required",
    );
  if (env.HOST && env.HOST !== "127.0.0.1")
    throw new Error("The test adapter requires HOST=127.0.0.1");
  const raw = env.LAND_COLYSEUS_PORT || "2567";
  const port = Number(raw);
  if (!/^\d+$/.test(raw) || port < 1 || port > 65535)
    throw new Error("Invalid LAND_COLYSEUS_PORT");
  const ownerPlayerKey = env.LAND_OWNER_PLAYER_KEY || TEST_PLAYER_KEY;
  if (!isAgentKey(ownerPlayerKey))
    throw new Error("Invalid LAND_OWNER_PLAYER_KEY");
  let adjacency = localTestAdjacency();
  if (env.LAND_ADJACENCY_FILE) {
    if (statSync(env.LAND_ADJACENCY_FILE).size > MAX_ADJACENCY_BYTES)
      throw new Error("Land adjacency is too large");
    adjacency = parseAdjacencyJson(
      readFileSync(env.LAND_ADJACENCY_FILE, "utf8"),
    );
  }
  return {
    port,
    host: "127.0.0.1",
    ownerPlayerKey,
    adjacency,
    dataDir: resolve(
      env.LAND_DATA_DIR ||
        fileURLToPath(
          new URL("../../../.data/" + adjacency.landKey + "/", import.meta.url),
        ),
    ),
    mapFile:
      env.MAP_FILE ||
      fileURLToPath(new URL("../../../maps/empty-land.json", import.meta.url)),
  };
}
