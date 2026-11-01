import assert from "node:assert/strict";
import { localTestAdjacency } from "@linked-realms/shared";
import { smoke } from "./local-smoke.ts";
assert.deepEqual(await smoke(), localTestAdjacency());
console.log(
  "PASS: default startup, fake agent identity, map, local Character and movement without RPC/wallet/ticket",
);
