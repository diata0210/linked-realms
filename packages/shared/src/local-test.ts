import { isAgentKey, type AgentKey, type LandAdjacency } from "./adjacency.ts";

// Synthetic public identifiers, not keys derived from a seed. Never authentication.
export const TEST_PLAYER_KEY: AgentKey = "11".repeat(32);
export const TEST_LAND_KEY: AgentKey = "aa".repeat(32);
export function localTestAdjacency(): LandAdjacency {
  return { version: 1, landKey: TEST_LAND_KEY, neighbors: {} };
}

/** Fake agent identity for local development until G4 integrates verified admission. */
export function testAgentIdentity(value: unknown): AgentKey {
  if (
    typeof value !== "object" ||
    value === null ||
    !isAgentKey((value as Record<string, unknown>).playerKey)
  )
    throw new Error("Invalid test player key");
  return (value as { playerKey: AgentKey }).playerKey;
}
