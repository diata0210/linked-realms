import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  CHARACTER_STAT_KEYS,
  INITIAL_STAT_VALUE,
  isAgentKey,
  type AgentKey,
} from "@linked-realms/shared";

export interface StoredPlayerState {
  stats: Record<string, number>;
  inventory: Record<string, number>;
}

export function initialPlayerState(): StoredPlayerState {
  return {
    stats: Object.fromEntries(
      CHARACTER_STAT_KEYS.map((key) => [key, Number(INITIAL_STAT_VALUE)]),
    ),
    inventory: {},
  };
}

function counts(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Invalid stored player state");
  const entries = Object.entries(value);
  for (const [key, count] of entries) {
    if (
      key.length === 0 ||
      [...key].some((char) => char < " " || char === "\x7f") ||
      !Number.isInteger(count) ||
      count < 0 ||
      count > 0xffffffff
    )
      throw new Error("Invalid stored player state");
  }
  return Object.fromEntries(entries);
}

function checkedState(stats: unknown, inventory: unknown): StoredPlayerState {
  const state = { stats: counts(stats), inventory: counts(inventory) };
  if (CHARACTER_STAT_KEYS.some((key) => !Object.hasOwn(state.stats, key)))
    throw new Error("Missing stored Character stat");
  return state;
}

/** The game Node owns this file. It stores no identity seed, rights or gold. */
export class LandStore {
  #db: DatabaseSync;
  #closed = false;
  #failed = false;

  constructor(file: string, landKey: AgentKey) {
    if (!isAgentKey(landKey)) throw new Error("Invalid Land key");
    mkdirSync(dirname(file), { recursive: true });
    this.#db = new DatabaseSync(file);
    try {
      this.#db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;");
      this.#transaction(() => {
        const version = this.#db.prepare("PRAGMA user_version").get()!
          .user_version;
        if (version === 0) {
          const tables = this.#db
            .prepare(
              "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
            )
            .all();
          if (tables.length !== 0)
            throw new Error("Unversioned existing Land database");
          this.#db.exec(`
            CREATE TABLE land_metadata (id INTEGER PRIMARY KEY CHECK (id=1), land_key TEXT NOT NULL);
            CREATE TABLE player_state (
              player_key TEXT PRIMARY KEY,
              stats TEXT NOT NULL CHECK(json_valid(stats)),
              inventory TEXT NOT NULL CHECK(json_valid(inventory))
            );
            PRAGMA user_version=1;
          `);
          this.#db
            .prepare("INSERT INTO land_metadata(id,land_key) VALUES(1,?)")
            .run(landKey);
        } else if (version !== 1)
          throw new Error("Unsupported Land schema version");
        const stored = this.#db
          .prepare("SELECT land_key FROM land_metadata WHERE id=1")
          .get();
        if (stored?.land_key !== landKey)
          throw new Error("Land database belongs to another Land");
      });
    } catch (error) {
      this.close();
      throw error;
    }
  }

  #ready(): void {
    if (this.#closed || this.#failed)
      throw new Error("Land storage unavailable");
  }

  #transaction<T>(task: () => T): T {
    this.#ready();
    try {
      this.#db.exec("BEGIN IMMEDIATE");
      const value = task();
      this.#db.exec("COMMIT");
      return value;
    } catch (error) {
      this.#failed = true;
      try {
        this.#db.exec("ROLLBACK");
      } catch {
        /* A failed BEGIN has no transaction to roll back. */
      }
      throw error;
    }
  }

  loadOrCreate(playerKey: AgentKey): StoredPlayerState {
    if (!isAgentKey(playerKey)) throw new Error("Invalid Player key");
    return this.#transaction(() => {
      const row = this.#db
        .prepare("SELECT stats,inventory FROM player_state WHERE player_key=?")
        .get(playerKey);
      if (row)
        return checkedState(
          JSON.parse(String(row.stats)),
          JSON.parse(String(row.inventory)),
        );
      const state = initialPlayerState();
      this.#db
        .prepare(
          "INSERT INTO player_state(player_key,stats,inventory) VALUES(?,?,?)",
        )
        .run(
          playerKey,
          JSON.stringify(state.stats),
          JSON.stringify(state.inventory),
        );
      return state;
    });
  }

  save(playerKey: AgentKey, value: StoredPlayerState): void {
    if (!isAgentKey(playerKey)) throw new Error("Invalid Player key");
    const state = checkedState(value.stats, value.inventory);
    this.#transaction(() => {
      this.#db
        .prepare(
          `INSERT INTO player_state(player_key,stats,inventory) VALUES(?,?,?)
        ON CONFLICT(player_key) DO UPDATE SET stats=excluded.stats,inventory=excluded.inventory`,
        )
        .run(
          playerKey,
          JSON.stringify(state.stats),
          JSON.stringify(state.inventory),
        );
    });
  }

  close(): void {
    if (!this.#closed) {
      this.#db.close();
      this.#closed = true;
    }
  }
}
