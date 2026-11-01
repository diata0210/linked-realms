import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, expect, it } from "vitest";
import { TEST_LAND_KEY, TEST_PLAYER_KEY } from "@linked-realms/shared";
import { LandStore, initialPlayerState } from "./land-store.ts";

const stores: LandStore[] = [];
const directories: string[] = [];
function database(): string {
  const directory = mkdtempSync(join(tmpdir(), "g2-land-store-"));
  directories.push(directory);
  return join(directory, "land.db");
}
function open(file: string, land = TEST_LAND_KEY): LandStore {
  const store = new LandStore(file, land);
  stores.push(store);
  return store;
}
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
  for (const dir of directories.splice(0)) {
    if (
      dirname(resolve(dir)) !== resolve(tmpdir()) ||
      !basename(dir).startsWith("g2-land-store-")
    )
      throw new Error("Unexpected test directory");
    rmSync(dir, { recursive: true, force: true });
  }
});
it("persists stats/inventory across close and reopen", () => {
  const file = database(),
    store = open(file);
  const state = store.loadOrCreate(TEST_PLAYER_KEY);
  expect(state).toEqual(initialPlayerState());
  state.stats.strength = 7;
  state.stats.crafting = 2;
  state.inventory.wood = 3;
  store.save(TEST_PLAYER_KEY, state);
  store.close();
  expect(open(file).loadOrCreate(TEST_PLAYER_KEY)).toEqual(state);
});
it("keeps each Land and Player independent and refuses a reused Land file", () => {
  const file = database(),
    store = open(file);
  const state = initialPlayerState();
  state.stats.strength = 9;
  store.save(TEST_PLAYER_KEY, state);
  expect(store.loadOrCreate("22".repeat(32))).toEqual(initialPlayerState());
  expect(
    open(database(), "bb".repeat(32)).loadOrCreate(TEST_PLAYER_KEY),
  ).toEqual(initialPlayerState());
  store.close();
  expect(() => open(file, "bb".repeat(32))).toThrow("another Land");
  expect(open(file).loadOrCreate(TEST_PLAYER_KEY)).toEqual(state);
});
it("uses versioned WAL/FULL storage with no gold or private-key tables", () => {
  const file = database();
  open(file).loadOrCreate(TEST_PLAYER_KEY);
  const db = new DatabaseSync(file);
  try {
    expect(db.prepare("PRAGMA journal_mode").get()!.journal_mode).toBe("wal");
    expect(db.prepare("PRAGMA user_version").get()!.user_version).toBe(1);
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      .all()
      .map((row) => row.name);
    expect(tables).toEqual(["land_metadata", "player_state"]);
  } finally {
    db.close();
  }
});
it("rejects future schema and existing unversioned databases", () => {
  for (const sql of [
    "PRAGMA user_version=2",
    "CREATE TABLE unknown(value TEXT)",
  ]) {
    const file = database(),
      db = new DatabaseSync(file);
    db.exec(sql);
    db.close();
    expect(() => open(file)).toThrow();
  }
});
it("does not replace corrupt persisted state with defaults", () => {
  const file = database(),
    store = open(file);
  store.loadOrCreate(TEST_PLAYER_KEY);
  const db = new DatabaseSync(file);
  db.prepare("UPDATE player_state SET stats=?").run(
    JSON.stringify({ ...initialPlayerState().stats, strength: "bad" }),
  );
  db.close();
  expect(() => store.loadOrCreate(TEST_PLAYER_KEY)).toThrow(
    "Invalid stored player state",
  );
  expect(() => store.loadOrCreate("33".repeat(32))).toThrow(
    "storage unavailable",
  );
});
it("rolls back failed writes and fails closed until the store is reopened", () => {
  const file = database(),
    store = open(file);
  store.loadOrCreate(TEST_PLAYER_KEY);
  const db = new DatabaseSync(file);
  try {
    db.exec(
      "CREATE TRIGGER deny_update BEFORE UPDATE ON player_state BEGIN SELECT RAISE(ABORT, 'disk failure probe'); END;",
    );
    const changed = initialPlayerState();
    changed.stats.strength = 8;
    changed.inventory.wood = 5;
    expect(() => store.save(TEST_PLAYER_KEY, changed)).toThrow(
      "disk failure probe",
    );
    const row = db
      .prepare("SELECT stats,inventory FROM player_state WHERE player_key=?")
      .get(TEST_PLAYER_KEY)!;
    expect(JSON.parse(String(row.stats))).toEqual(initialPlayerState().stats);
    expect(JSON.parse(String(row.inventory))).toEqual({});
    expect(() => store.loadOrCreate(TEST_PLAYER_KEY)).toThrow(
      "storage unavailable",
    );
  } finally {
    db.close();
  }
});
it("rejects invalid IDs/counts without accepting fabricated state", () => {
  const store = open(database());
  expect(() => store.loadOrCreate("0x1234")).toThrow();
  for (const count of [-1, 0.5, 4294967296, NaN, Infinity]) {
    const state = initialPlayerState();
    state.inventory.wood = count;
    expect(() => store.save(TEST_PLAYER_KEY, state)).toThrow();
  }
  expect(store.loadOrCreate(TEST_PLAYER_KEY)).toEqual(initialPlayerState());
});
it("preserves own keys without prototype assignment", () => {
  const store = open(database()),
    state = initialPlayerState();
  state.inventory = Object.fromEntries([
    ["__proto__", 3],
    ["constructor", 2],
  ]);
  store.save(TEST_PLAYER_KEY, state);
  expect(Object.entries(store.loadOrCreate(TEST_PLAYER_KEY).inventory)).toEqual(
    [
      ["__proto__", 3],
      ["constructor", 2],
    ],
  );
});
