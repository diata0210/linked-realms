import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAdjacencyJson, parseLandMap } from "@linked-realms/shared";
import { renderEmptyLand } from "../../shared/src/codegen/index.ts";
const output = resolve(
  process.argv[2] ?? fileURLToPath(new URL("../.data/world", import.meta.url)),
);
const map = renderEmptyLand();
parseLandMap(map);
for (const name of ["land-a", "land-b"]) {
  const adjacency = parseAdjacencyJson(
    readFileSync(
      new URL(`../../shared/fixtures/two-lands/${name}.json`, import.meta.url),
      "utf8",
    ),
  );
  const dir = resolve(output, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    resolve(dir, "adjacency.json"),
    `${JSON.stringify(adjacency, null, 2)}\n`,
  );
  writeFileSync(resolve(dir, "map.json"), map);
}
console.log(
  `Wrote two local Lands to ${output}; no credentials or persistent gold.`,
);
