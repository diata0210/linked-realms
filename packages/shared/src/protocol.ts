// Game messages. Production bridge-owned admission replaces the G1 test options in G4.
import {
  parseAdjacency,
  type AgentKey,
  type LandAdjacency,
} from "./adjacency.ts";
import type { MoveInput } from "./movement.ts";
export const LAND_ROOM = "land";
/** Local test adapter only: this key assertion is NOT proof of possession. */
export interface JoinOptions {
  playerKey: AgentKey;
}
export interface PlayerStateShape {
  playerKey: AgentKey;
  x: number;
  y: number;
  isOwner: boolean;
}
export const Messages = { map: "map", land: "land", input: "input" } as const;
export interface MapMessage {
  tiled: string;
}
/** Exactly the config/fixture adjacency shape; no coordinates or wallet aliases. */
export type LandMessage = LandAdjacency;
export const parseLandMessage = parseAdjacency;
export type InputMessage = MoveInput;
export function parseInputMessage(value: unknown): InputMessage | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const v = value as Record<string, unknown>;
  if (
    !["up", "down", "left", "right"].every((key) => typeof v[key] === "boolean")
  )
    return undefined;
  return {
    up: v.up as boolean,
    down: v.down as boolean,
    left: v.left as boolean,
    right: v.right as boolean,
  };
}
