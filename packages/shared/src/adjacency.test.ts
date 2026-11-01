import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  parseAdjacency,
  parseAdjacencyJson,
  reciprocalArrival,
} from "./adjacency.ts";

const fixture = (name: string) =>
  parseAdjacencyJson(
    readFileSync(
      new URL(`../fixtures/two-lands/${name}.json`, import.meta.url),
      "utf8",
    ),
  );
const a = fixture("land-a");
const b = fixture("land-b");

describe("version-1 adjacency", () => {
  it("defines reciprocal fixtures and absent Gates", () => {
    expect(reciprocalArrival(a, b, "east")).toBe("west");
    expect(reciprocalArrival(b, a, "west")).toBe("east");
    expect(a.neighbors.north).toBeUndefined();
    expect(reciprocalArrival(a, b, "north")).toBeUndefined();
    expect(
      reciprocalArrival(a, { ...b, neighbors: {} }, "east"),
    ).toBeUndefined();
  });

  it.each([
    null,
    [],
    {},
    { ...a, version: 2 },
    { ...a, extra: true },
    { ...a, landKey: "A".repeat(64) },
    { ...a, landKey: `0x${a.landKey}` },
    { ...a, landKey: "a".repeat(63) },
    { ...a, neighbors: [] },
    { ...a, neighbors: { up: b.landKey } },
    { ...a, neighbors: { east: a.landKey } },
    { ...a, neighbors: { east: "0x1234" } },
  ])("rejects malformed topology %j", (value) => {
    expect(() => parseAdjacency(value)).toThrow();
  });

  it("rejects duplicate fields before JSON can erase them", () => {
    for (const text of [
      `{"version":2,"version":1,"landKey":"${a.landKey}","neighbors":{}}`,
      `{"version":1,"landKey":"${a.landKey}","neighbors":{"east":"${b.landKey}","e\\u0061st":"${b.landKey}"}}`,
      `${JSON.stringify(a)} trailing`,
      " ".repeat(2049),
    ])
      expect(() => parseAdjacencyJson(text)).toThrow();
  });
});
