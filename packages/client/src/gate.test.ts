import { describe, expect, it } from "vitest";
import { localTestAdjacency } from "@linked-realms/shared";
import { createGateEdge, decideGate } from "./gate.ts";

describe("decideGate", () => {
  it("disables missing destinations", () => {
    expect(decideGate("east", localTestAdjacency())).toEqual({
      kind: "notice",
      text: "No Land to the east",
    });
  });
  it("uses key adjacency, without claiming admission or online status", () => {
    const here = localTestAdjacency();
    const destination = "bb".repeat(32);
    here.neighbors.east = destination;
    expect(decideGate("east", here)).toEqual({
      kind: "travel",
      landKey: destination,
      sourceLandKey: here.landKey,
    });
  });
});

describe("createGateEdge", () => {
  it("fires once per step onto a Gate until the Character steps off", () => {
    const edge = createGateEdge();
    expect(edge(undefined)).toBeUndefined();
    expect(edge("east")).toBe("east");
    expect(edge("east")).toBeUndefined();
    expect(edge(undefined)).toBeUndefined();
    expect(edge("east")).toBe("east");
  });
  it("fires again when moving straight onto another Gate", () => {
    const edge = createGateEdge();
    edge("north");
    expect(edge("west")).toBe("west");
  });
});
