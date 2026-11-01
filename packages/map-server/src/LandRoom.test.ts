import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve, join } from "node:path";
import { LandStore } from "./land-store.ts";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import {
  LAND_ROOM,
  Messages,
  parseLandMap,
  spawnPosition,
  localTestAdjacency,
  TEST_PLAYER_KEY,
} from "@linked-realms/shared";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  onTestFinished,
} from "vitest";
import { clock, type LandRoom } from "./LandRoom.ts";
import { createServer } from "./server.ts";
const mapText = readFileSync(
  new URL("../../../maps/empty-land.json", import.meta.url),
  "utf8",
);
const map = parseLandMap(mapText);
const spawn = spawnPosition(map);
const owner = TEST_PLAYER_KEY;
const visitor = "22".repeat(32);
const adjacency = localTestAdjacency();
const idle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
describe("local test LandRoom", () => {
  let colyseus: ColyseusTestServer;
  let store: LandStore;
  let dataDir: string;
  beforeAll(async () => {
    dataDir = mkdtempSync(join(tmpdir(), "g2-room-"));
    if (
      dirname(resolve(dataDir)) !== resolve(tmpdir()) ||
      !basename(dataDir).startsWith("g2-room-")
    )
      throw new Error("Unexpected test directory");
    store = new LandStore(join(dataDir, "land.db"), adjacency.landKey);
    colyseus = await boot(
      createServer({ map, mapText, adjacency, ownerPlayerKey: owner, store }),
    );
  });
  afterEach(() => colyseus.cleanup());
  afterAll(async () => {
    try {
      await colyseus.shutdown();
    } finally {
      store.close();
      rmSync(dataDir, { recursive: true, force: true });
    }
  });
  async function createRoom() {
    return colyseus.createRoom<LandRoom>(LAND_ROOM, {});
  }
  it("shows both players to both clients and marks only the Land owner", async () => {
    const room = await createRoom();
    const a = await colyseus.connectTo(room, { playerKey: owner });
    const b = await colyseus.connectTo(room, { playerKey: visitor });
    await idle(200); // let a patch reach both clients

    for (const client of [a, b]) {
      expect(client.state.landKey).toBe(adjacency.landKey);
      expect(client.state.players.size).toBe(2);
      const mine = client.state.players.get(a.sessionId)!;
      const theirs = client.state.players.get(b.sessionId)!;
      expect(mine.playerKey).toBe(owner);
      expect(mine.isOwner).toBe(true);
      expect(theirs.playerKey).toBe(visitor);
      expect(theirs.isOwner).toBe(false);
      expect(mine.x).toBe(spawn.x);
      expect(mine.y).toBe(spawn.y);
    }
  });

  it("sends the map text and the Land info after joining", async () => {
    const room = await createRoom();
    const client = await colyseus.sdk.joinById(room.roomId, {
      playerKey: visitor,
    });
    const mapMessage = new Promise<{ tiled: string }>((resolve) =>
      client.onMessage(Messages.map, resolve),
    );
    const landMessage = new Promise<unknown>((resolve) =>
      client.onMessage(Messages.land, resolve),
    );
    expect((await mapMessage).tiled).toBe(mapText);
    expect(await landMessage).toEqual(adjacency);
  });

  it("moves the player on the server and the Mine blocks it", async () => {
    const room = await createRoom();
    const client = await colyseus.connectTo(room, { playerKey: owner });
    client.send(Messages.input, {
      up: false,
      down: false,
      left: false,
      right: true,
    });
    await idle(300);
    const player = room.state.players.get(client.sessionId)!;
    expect(player.x).toBeGreaterThan(spawn.x);
    expect(player.y).toBe(spawn.y);

    // Re-center under the Mine after proving horizontal movement.
    player.x = spawn.x;
    player.y = spawn.y;
    client.send(Messages.input, {
      up: true,
      down: false,
      left: false,
      right: false,
    });
    await idle(1500);
    const mineBottom = (map.mine.tileY + map.mine.height) * map.tileSize;
    expect(player.y).toBeLessThan(spawn.y);
    expect(player.y).toBeGreaterThanOrEqual(mineBottom);
    const blockedAt = player.y;
    await idle(300);
    expect(player.y).toBe(blockedAt);
  });

  it("ignores invalid input", async () => {
    const room = await createRoom();
    const client = await colyseus.connectTo(room, { playerKey: owner });
    client.send(Messages.input, { up: "yes", down: 1 });
    client.send(Messages.input, "right");
    await idle(300);
    const player = room.state.players.get(client.sessionId)!;
    expect(player.x).toBe(spawn.x);
    expect(player.y).toBe(spawn.y);
  });

  it("drops input beyond the per-second limit", async () => {
    const room = await createRoom();
    // Frozen clock: all sends fall in one window, so the test cannot straddle a boundary.
    const real = clock.now;
    const frozen = Date.now();
    clock.now = () => frozen;
    onTestFinished(() => {
      clock.now = real;
    });
    const client = await colyseus.connectTo(room, { playerKey: owner });
    const stop = { up: false, down: false, left: false, right: false };
    for (let i = 0; i < 30; i++) client.send(Messages.input, stop);
    client.send(Messages.input, { ...stop, right: true });
    await idle(300);
    expect(room.state.players.get(client.sessionId)!.x).toBe(spawn.x);
  });

  it("starts local Character defaults without a gold balance", async () => {
    const room = await createRoom();
    const client = await colyseus.connectTo(room, { playerKey: visitor });
    const player = room.state.players.get(client.sessionId)!;
    expect(player.stats.toJSON()).toEqual({
      strength: 1,
      agility: 1,
      intelligence: 1,
      stamina: 1,
    });
    expect(player.inventory.size).toBe(0);
    expect(player.toJSON()).not.toHaveProperty("gold");
    expect(room.state.toJSON()).not.toHaveProperty("mining");
    expect(room.maxClients).toBe(64);
  });
  it("ignores client authority, map and unverified arrival hints", async () => {
    const client = await colyseus.sdk.create(LAND_ROOM, {
      playerKey: visitor,
      ownerPlayerKey: visitor,
      isOwner: true,
      adjacency: { version: 1, landKey: "ff".repeat(32), neighbors: {} },
      gate: "west",
      sourceLandKey: "bb".repeat(32),
      verified: true,
      map: {},
      mapText: "invalid",
      maxClients: 999,
      now: 1,
    });
    client.onMessage(Messages.map, () => {});
    client.onMessage(Messages.land, () => {});
    await idle(150);
    const player = client.state.players.get(client.sessionId)!;
    expect(client.state.landKey).toBe(adjacency.landKey);
    expect(player.isOwner).toBe(false);
    expect({ x: player.x, y: player.y }).toEqual(spawn);
  });
  it("refuses a second room", async () => {
    await createRoom();
    await expect(
      colyseus.sdk.create(LAND_ROOM, { playerKey: owner }),
    ).rejects.toThrow();
  });
  it("removes a Player on leave and permits a fresh local join", async () => {
    const room = await createRoom();
    const client = await colyseus.connectTo(room, { playerKey: owner });
    const second = await colyseus.connectTo(room, { playerKey: visitor });
    await client.leave();
    await idle(100);
    expect(room.state.players.size).toBe(1);
    await colyseus.connectTo(room, { playerKey: owner });
    expect(room.state.players.size).toBe(2);
    await second.leave();
  });
  it.each([
    {},
    { playerKey: "0x1234" },
    { playerKey: "A".repeat(64) },
    { playerKey: 7 },
  ])("rejects malformed identity %j", async (options) => {
    const room = await createRoom();
    await expect(colyseus.connectTo(room, options)).rejects.toThrow(
      "Invalid test player key",
    );
    expect(room.state.players.size).toBe(0);
  });
  it("restores stats and inventory on a fresh join to this Land", async () => {
    const room = await createRoom();
    await colyseus.connectTo(room, { playerKey: owner });
    const key = "33".repeat(32),
      client = await colyseus.connectTo(room, { playerKey: key });
    const player = room.state.players.get(client.sessionId)!;
    player.stats.set("strength", 7);
    player.inventory.set("wood", 3);
    await client.leave();
    await idle(100);
    const joined = await colyseus.connectTo(room, { playerKey: key });
    const loaded = room.state.players.get(joined.sessionId)!;
    expect(loaded.stats.get("strength")).toBe(7);
    expect(loaded.inventory.get("wood")).toBe(3);
    expect(store.loadOrCreate(key).stats.strength).toBe(7);
  });
  it("rejects duplicate and concurrent sessions for the same key", async () => {
    const room = await createRoom();
    const results = await Promise.allSettled([
      colyseus.connectTo(room, { playerKey: owner }),
      colyseus.connectTo(room, { playerKey: owner }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(room.state.players.size).toBe(1);
    await expect(
      colyseus.connectTo(room, { playerKey: owner }),
    ).rejects.toThrow("already in this Land");
  });
});
