import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LandStore } from "./land-store.ts";
import { parseLandMap } from "@linked-realms/shared";
import { loadConfig } from "./config.ts";
import { createServer } from "./server.ts";
async function main(): Promise<void> {
  const config = loadConfig();
  const mapText = readFileSync(config.mapFile, "utf8");
  const store = new LandStore(
    join(config.dataDir, "land.db"),
    config.adjacency.landKey,
  );
  process.once("exit", () => store.close());
  const server = createServer({
    store,
    map: parseLandMap(mapText),
    mapText,
    adjacency: config.adjacency,
    ownerPlayerKey: config.ownerPlayerKey,
  });
  await server.listen(config.port, config.host);
  console.log(
    `Local test Land ${config.adjacency.landKey} at ws://${config.host}:${config.port}`,
  );
  console.log(
    "FAKE agent-key identity; local development only. Gold unavailable; mining disabled.",
  );
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
