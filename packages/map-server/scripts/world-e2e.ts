import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { reciprocalArrival } from "@linked-realms/shared";
import { smoke } from "./local-smoke.ts";
const fixture = (name: string) =>
  fileURLToPath(
    new URL(`../../shared/fixtures/two-lands/${name}.json`, import.meta.url),
  );
const a = await smoke(fixture("land-a"));
const b = await smoke(fixture("land-b"));
assert.equal(reciprocalArrival(a, b, "east"), "west");
assert.equal(reciprocalArrival(b, a, "west"), "east");
console.log(
  "PASS: both local Land entry points consume the reciprocal fixture; production agent travel remains G4",
);
