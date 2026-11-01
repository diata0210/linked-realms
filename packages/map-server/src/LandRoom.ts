import { Room, ServerError, type Client } from "@colyseus/core";
import { schema, t, type SchemaType } from "@colyseus/schema";
import {
  Messages,
  SERVER_TICK_HZ,
  parseInputMessage,
  spawnPosition,
  step,
  testAgentIdentity,
  type AgentKey,
  type LandAdjacency,
  type LandMap,
  type LandMessage,
  type MapMessage,
  type MoveInput,
} from "@linked-realms/shared";
import { initialPlayerState, type LandStore } from "./land-store.ts";
export const PlayerState = schema(
  {
    playerKey: t.string(),
    x: t.float32(),
    y: t.float32(),
    isOwner: t.boolean(),
    stats: t.map("uint32"),
    inventory: t.map("uint32"),
  },
  "PlayerState",
);
export type PlayerState = SchemaType<typeof PlayerState>;
export const LandState = schema(
  { landKey: t.string(), players: t.map(PlayerState) },
  "LandState",
);
export type LandState = SchemaType<typeof LandState>;
export interface LandRoomOptions {
  map: LandMap;
  mapText: string;
  adjacency: LandAdjacency;
  ownerPlayerKey: AgentKey;
  store?: LandStore;
}
export const clock = { now: (): number => Date.now() };
const liveRooms = new Set<unknown>();
export const MAX_INPUTS_PER_SECOND = 30;
const NO_INPUT: MoveInput = {
  up: false,
  down: false,
  left: false,
  right: false,
};
interface Session {
  input: MoveInput;
  windowStart: number;
  windowCount: number;
}
export class LandRoom extends Room<{ state: LandState }> {
  override maxClients = 64;
  #options!: LandRoomOptions;
  #sessions = new Map<string, Session>();
  override onCreate(options: LandRoomOptions): void {
    if (liveRooms.size > 0) throw new ServerError(403, "room already exists");
    liveRooms.add(this);
    this.#options = options;
    this.state = new LandState();
    this.state.landKey = options.adjacency.landKey;
    this.onMessage(Messages.input, (client, message) =>
      this.#onInput(client, message),
    );
    this.setSimulationInterval(
      (dtMs) => this.#tick(dtMs),
      1000 / SERVER_TICK_HZ,
    );
  }
  override onAuth(
    _client: Client,
    joinOptions: unknown,
  ): { playerKey: AgentKey } {
    let playerKey: AgentKey;
    try {
      playerKey = testAgentIdentity(joinOptions);
    } catch {
      throw new ServerError(4401, "Invalid test player key");
    }
    if (this.#playerOf(playerKey))
      throw new ServerError(4401, "already in this Land");
    return { playerKey };
  }
  override onJoin(client: Client): void {
    const { playerKey } = client.auth as { playerKey: AgentKey };
    if (this.#playerOf(playerKey))
      throw new ServerError(4401, "already in this Land");
    const { map, mapText, adjacency, ownerPlayerKey } = this.#options;
    // G1 has no verified source-Land hint. Never trust client arrival/adjacency claims.
    const spawn = spawnPosition(map);
    const player = new PlayerState();
    player.playerKey = playerKey;
    player.x = spawn.x;
    player.y = spawn.y;
    player.isOwner = playerKey === ownerPlayerKey;
    const stored =
      this.#options.store?.loadOrCreate(playerKey) ?? initialPlayerState();
    for (const [key, value] of Object.entries(stored.stats))
      player.stats.set(key, value);
    for (const [key, value] of Object.entries(stored.inventory))
      player.inventory.set(key, value);
    this.state.players.set(client.sessionId, player);
    this.#sessions.set(client.sessionId, {
      input: NO_INPUT,
      windowStart: 0,
      windowCount: 0,
    });
    client.send(Messages.map, { tiled: mapText } satisfies MapMessage);
    client.send(Messages.land, adjacency satisfies LandMessage);
  }
  override onDispose(): void {
    try {
      for (const player of this.state?.players.values() ?? [])
        this.#savePlayer(player);
    } finally {
      liveRooms.delete(this);
    }
  }
  override onLeave(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (player) this.#savePlayer(player);
    this.state.players.delete(client.sessionId);
    this.#sessions.delete(client.sessionId);
  }
  #savePlayer(player: PlayerState): void {
    this.#options.store?.save(player.playerKey, {
      stats: Object.fromEntries(player.stats),
      inventory: Object.fromEntries(player.inventory),
    });
  }
  #playerOf(key: AgentKey): PlayerState | undefined {
    for (const player of this.state.players.values())
      if (player.playerKey === key) return player;
    return undefined;
  }
  /** Counts the message against the session's budget; undefined when it is over. */
  #admit(client: Client): Session | undefined {
    const session = this.#sessions.get(client.sessionId);
    if (!session) return undefined;
    const nowMs = clock.now();
    if (nowMs - session.windowStart >= 1000) {
      session.windowStart = nowMs;
      session.windowCount = 0;
    }
    return ++session.windowCount > MAX_INPUTS_PER_SECOND ? undefined : session;
  }

  #onInput(client: Client, message: unknown): void {
    const session = this.#admit(client);
    if (!session) return;
    const input = parseInputMessage(message);
    if (input) session.input = input;
  }

  #tick(dtMs: number): void {
    const { map } = this.#options;
    for (const [sessionId, player] of this.state.players) {
      const input = this.#sessions.get(sessionId)?.input ?? NO_INPUT;
      const next = step(map, { x: player.x, y: player.y }, input, dtMs);
      player.x = next.x;
      player.y = next.y;
    }
  }
}
