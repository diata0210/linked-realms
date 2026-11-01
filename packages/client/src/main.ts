import { Client, type Room } from "@colyseus/sdk";
import {
  LAND_ROOM,
  Messages,
  parseLandMessage,
  unavailableGold,
  type JoinOptions,
  type MapMessage,
} from "@linked-realms/shared";
import type { Game } from "phaser";
import { parseConfig } from "./config.ts";
import { shortKey } from "./format.ts";
import { createGateEdge, decideGate } from "./gate.ts";
import { LandScene, startGame } from "./scene.ts";

const config = parseConfig(import.meta.env);
function el(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node;
}
const status = el("status");
const notice = el("notice");
const enter = el("enter") as HTMLButtonElement;
const leave = el("leave") as HTMLButtonElement;
el("identity").textContent = `Test Player ${shortKey(config.playerKey)}`;
void unavailableGold.balance(config.playerKey).then((balance) => {
  el("gold").textContent =
    balance.status === "unavailable" ? "Gold unavailable" : balance.status;
});
let room: Room | undefined;
let game: Game | undefined;
function clear(): void {
  game?.destroy(true);
  game = undefined;
  room = undefined;
  enter.disabled = false;
  leave.disabled = true;
}
enter.addEventListener("click", () => {
  enter.disabled = true;
  notice.textContent = "";
  status.textContent = "Joining local Land…";
  void (async () => {
    try {
      const joined = await new Client(config.serverUrl).joinOrCreate(
        LAND_ROOM,
        { playerKey: config.playerKey } satisfies JoinOptions,
      );
      room = joined;
      const edge = createGateEdge();
      const scene = new LandScene(
        joined,
        (text) => {
          status.textContent = text;
        },
        (text) => {
          notice.textContent = text;
        },
        (gate, land) => {
          const fired = edge(gate);
          if (!fired) return;
          const decision = decideGate(fired, land);
          notice.textContent =
            decision.kind === "notice"
              ? decision.text
              : `Neighbor ${shortKey(decision.landKey)}: agent travel is not available in this local test.`;
        },
      );
      joined.onMessage<MapMessage>(Messages.map, (message) =>
        scene.setMap(message.tiled),
      );
      joined.onMessage(Messages.land, (message: unknown) => {
        try {
          scene.setLand(parseLandMessage(message));
        } catch {
          notice.textContent = "Invalid Land topology";
          void joined.leave();
        }
      });
      joined.onLeave(() => {
        clear();
        status.textContent = "Left Land";
      });
      joined.onError((_code, message) => {
        notice.textContent = message ?? "Connection failed";
      });
      game = startGame(el("game"), scene);
      leave.disabled = false;
    } catch (error) {
      clear();
      status.textContent = "Could not enter Land";
      notice.textContent =
        error instanceof Error ? error.message : String(error);
    }
  })();
});
leave.addEventListener("click", () => {
  void room?.leave();
});
