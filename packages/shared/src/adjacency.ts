import { arrivalGate, DIRECTIONS, type Direction } from "./rules/world.ts";

/** Diagnostic public key representation; never a private seed or wallet address. */
export type AgentKey = string;

export function isAgentKey(value: unknown): value is AgentKey {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

/** Game-owned topology, not an admission credential. Also the LandMessage shape. */
export interface LandAdjacency {
  version: 1;
  landKey: AgentKey;
  neighbors: Partial<Record<Direction, AgentKey>>;
}

export const MAX_ADJACENCY_BYTES = 2048;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseAdjacency(value: unknown): LandAdjacency {
  if (
    !object(value) ||
    Object.keys(value).length !== 3 ||
    !Object.hasOwn(value, "version") ||
    !Object.hasOwn(value, "landKey") ||
    !Object.hasOwn(value, "neighbors") ||
    value.version !== 1 ||
    !isAgentKey(value.landKey) ||
    !object(value.neighbors)
  )
    throw new Error("Invalid version-1 Land adjacency");
  const neighbors: LandAdjacency["neighbors"] = {};
  for (const [direction, key] of Object.entries(value.neighbors)) {
    if (
      !DIRECTIONS.includes(direction as Direction) ||
      !isAgentKey(key) ||
      key === value.landKey
    )
      throw new Error("Invalid Land neighbor");
    neighbors[direction as Direction] = key;
  }
  return { version: 1, landKey: value.landKey, neighbors };
}

/** JSON.parse alone silently overwrites duplicate fields, including escaped names. */
export function parseAdjacencyJson(text: string): LandAdjacency {
  if (
    text.length > MAX_ADJACENCY_BYTES ||
    new TextEncoder().encode(text).length > MAX_ADJACENCY_BYTES
  )
    throw new Error("Land adjacency is too large");
  const adjacency = parseAdjacency(JSON.parse(text));
  // The validated shape contains only objects, strings and the version number.
  const tokens = text.match(/"(?:[^"\\]|\\.)*"|[{}:]/g) ?? [];
  const fields: Set<string>[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token === "{") fields.push(new Set());
    else if (token === "}") fields.pop();
    else if (token.startsWith('"') && tokens[i + 1] === ":") {
      const key = JSON.parse(token) as string;
      const current = fields.at(-1)!;
      if (current.has(key)) throw new Error("Duplicate Land adjacency field");
      current.add(key);
    }
  }
  return adjacency;
}

/** G4 can use this after verifying both Lands; reciprocity grants no entry rights. */
export function reciprocalArrival(
  source: LandAdjacency,
  destination: LandAdjacency,
  departure: Direction,
): Direction | undefined {
  const arrival = arrivalGate(departure);
  return source.neighbors[departure] === destination.landKey &&
    destination.neighbors[arrival] === source.landKey
    ? arrival
    : undefined;
}
