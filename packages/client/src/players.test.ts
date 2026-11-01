import { describe, expect, it } from "vitest";
import { readPlayer } from "./players.ts";

const playerKey = "ab".repeat(32);

describe("readPlayer", () => {
  it("accepts a well-formed player", () => {
    expect(readPlayer({ playerKey, x: 1, y: 2, isOwner: true })).toEqual({
      playerKey,
      x: 1,
      y: 2,
      isOwner: true,
    });
  });

  it.each([
    null,
    { playerKey: 5, x: 1, y: 2 },
    { playerKey: "0xnope", x: 1, y: 2 },
    { playerKey, x: Number.NaN, y: 2 },
    { playerKey, x: 1, y: Number.POSITIVE_INFINITY },
    { playerKey, x: "1", y: 2 },
  ])("rejects %j", (value) => {
    expect(readPlayer(value)).toBeUndefined();
  });
});
