import {
  type AgentKey,
  type Direction,
  type LandAdjacency,
} from "@linked-realms/shared";
/** Fires once per step onto a Gate; steps off re-arm it. */
export function createGateEdge(): (
  gate: Direction | undefined,
) => Direction | undefined {
  let last: Direction | undefined;
  return (gate) => {
    const fired = gate !== undefined && gate !== last ? gate : undefined;
    last = gate;
    return fired;
  };
}
export type GateDecision =
  | { kind: "notice"; text: string }
  | { kind: "travel"; landKey: AgentKey; sourceLandKey: AgentKey };
/** Topology supplies a destination only. The agent must separately admit the Player. */
export function decideGate(gate: Direction, here: LandAdjacency): GateDecision {
  const landKey = here.neighbors[gate];
  if (!landKey) return { kind: "notice", text: `No Land to the ${gate}` };
  return { kind: "travel", landKey, sourceLandKey: here.landKey };
}
