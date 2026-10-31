// Run with the SAME Node 26 executable as connect-bridge-spike.ts, without flags.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";

let directory, db, copy;
function pass(name) {
  console.log(`PASS ${name}`);
}
try {
  console.log(
    `Node ${process.version}; execArgv=${JSON.stringify(process.execArgv)}`,
  );
  assert.equal(Number(process.versions.node.split(".")[0]), 26);
  assert.equal(process.execArgv.length, 0);
  const { DatabaseSync } = await import("node:sqlite");
  pass("Node 26 DatabaseSync import without flags");
  directory = mkdtempSync(join(tmpdir(), "connect-sqlite-"));
  db = new DatabaseSync(join(directory, "source.db"));
  db.exec("CREATE TABLE entries (id INTEGER PRIMARY KEY, value TEXT NOT NULL)");
  db.exec("BEGIN; INSERT INTO entries VALUES (1, 'rolled back'); ROLLBACK");
  assert.equal(db.prepare("SELECT count(*) AS n FROM entries").get().n, 0);
  pass("transaction rollback leaves zero rows");
  db.exec("BEGIN; INSERT INTO entries VALUES (2, 'committed'); COMMIT");
  db.close();
  db = new DatabaseSync(join(directory, "source.db"));
  assert.equal(
    db.prepare("SELECT value FROM entries WHERE id=2").get().value,
    "committed",
  );
  pass("transaction commit survives reopen");
  const copyPath = join(directory, "copy.db");
  db.exec(`VACUUM INTO '${copyPath.replaceAll("'", "''")}'`);
  copy = new DatabaseSync(copyPath);
  assert.equal(
    copy.prepare("PRAGMA integrity_check").get().integrity_check,
    "ok",
  );
  assert.deepEqual(
    [...copy.prepare("SELECT * FROM entries").all()].map((r) => ({ ...r })),
    [{ id: 2, value: "committed" }],
  );
  pass("VACUUM INTO copy opens with committed row only and integrity_check=ok");
} catch (error) {
  console.error(`FAIL sqlite: ${error.message}`);
  process.exitCode = 1;
} finally {
  copy?.close();
  db?.close();
  if (directory) rmSync(directory, { recursive: true, force: true });
}
