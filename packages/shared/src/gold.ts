import type { AgentKey } from "./adjacency.ts";

export type GoldBalance =
  | { status: "unavailable" }
  | { status: "confirmed" | "pending" | "stale"; units: bigint };

/** C4 supplies chain reads and authorized transfers outside the game/Hub transport.
 * Units, authorization, wallet snapshots and settlement belong to C4.
 * This seam never mints, caches balances or exposes a local ledger.
 */
export interface GoldService {
  balance(playerKey: AgentKey): Promise<GoldBalance>;
  spend(playerKey: AgentKey, units: bigint, reference: string): Promise<void>;
}

export const unavailableGold: GoldService = {
  async balance() {
    return { status: "unavailable" };
  },
  async spend() {
    throw new Error("Gold unavailable until C4");
  },
};
