import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { Client } from "@colyseus/sdk";
import {
  LAND_ROOM,
  Messages,
  parseLandMap,
  parseLandMessage,
  spawnPosition,
  TEST_PLAYER_KEY,
  type LandMessage,
  type MapMessage,
} from "@linked-realms/shared";

async function freePort(): Promise<number> {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const address = listener.address();
  assert(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve) => listener.close(() => resolve()));
  return port;
}
async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const closed = once(child, "exit");
  child.kill();
  await closed;
}
/** Launches the real entry point and uses the unpatched SDK, with no external service. */
export async function smoke(adjacencyFile?: string): Promise<LandMessage> {
  const port = await freePort();
  const dataDir = mkdtempSync(join(tmpdir(), "g2-smoke-"));
  if (
    dirname(resolve(dataDir)) !== resolve(tmpdir()) ||
    !basename(dataDir).startsWith("g2-smoke-")
  )
    throw new Error("Unexpected test directory");
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("../src/main.ts", import.meta.url))],
    {
      env: {
        ...process.env,
        NODE_ENV: "development",
        HOST: "127.0.0.1",
        LAND_COLYSEUS_PORT: String(port),
        LAND_DATA_DIR: dataDir,
        LAND_ADJACENCY_FILE: adjacencyFile ?? "",
        LAND_OWNER_PLAYER_KEY: TEST_PLAYER_KEY,
        MAP_FILE: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  let output = "";
  child.stderr!.on("data", (data) => {
    output += String(data);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Server startup timeout: ${output}`)),
        10000,
      );
      child.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once("exit", (code) => {
        clearTimeout(timeout);
        reject(new Error(`Server exited ${code}: ${output}`));
      });
      child.stdout!.on("data", (data) => {
        output += String(data);
        if (output.includes("Local test Land")) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
    const room = await new Client(`http://127.0.0.1:${port}`).joinOrCreate(
      LAND_ROOM,
      { playerKey: TEST_PLAYER_KEY },
    );
    try {
      const result = await new Promise<LandMessage>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Map/state timeout")),
          5000,
        );
        let map: ReturnType<typeof parseLandMap> | undefined;
        let land: LandMessage | undefined;
        const check = () => {
          try {
            const player = room.state?.players?.get(room.sessionId);
            if (!map || !land || !player) return;
            assert.equal(player.playerKey, TEST_PLAYER_KEY);
            assert.equal(player.isOwner, true);
            assert.deepEqual({ x: player.x, y: player.y }, spawnPosition(map));
            assert.equal(player.stats.get("strength"), 1);
            assert.equal(player.inventory.size, 0);
            clearTimeout(timeout);
            resolve(land);
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        };
        room.onMessage<MapMessage>(Messages.map, (message) => {
          try {
            map = parseLandMap(message.tiled);
            check();
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });
        room.onMessage(Messages.land, (message: unknown) => {
          try {
            land = parseLandMessage(message);
            check();
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });
        room.onStateChange(check);
      });
      const x = room.state.players.get(room.sessionId).x as number;
      room.send(Messages.input, {
        up: false,
        down: false,
        left: false,
        right: true,
      });
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Movement timeout")),
          3000,
        );
        room.onStateChange(() => {
          if (room.state.players.get(room.sessionId).x > x) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
      return result;
    } finally {
      await room.leave();
    }
  } finally {
    await stop(child);
    rmSync(dataDir, { recursive: true, force: true });
  }
}
