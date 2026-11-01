import type { PlayerStateShape } from "@linked-realms/shared";
import { isAgentKey } from "@linked-realms/shared";

/** Map servers are untrusted (P1): render a player only when its state is well-formed. */
export function readPlayer(value: unknown): PlayerStateShape | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const p = value as Record<string, unknown>;
  if (!isAgentKey(p.playerKey)) return undefined;
  if (typeof p.x !== "number" || typeof p.y !== "number") return undefined;
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return undefined;
  return {
    playerKey: p.playerKey,
    x: p.x,
    y: p.y,
    isOwner: p.isOwner === true,
  };
}
