# Spec / Task
Continue Game track G2 from the owner-approved Hub Connect plan: persist per-Land, per-Player stats and inventory in land.db using Node SQLite. Preserve the local-only fake admission boundary until G4. No gold ledger or identity/private-key storage.

## Context reviewed
- Hub docs/PLAN.md sections 7, 10 and Game G1/G2/G4 acceptance.
- G1 map-server config/main/server/LandRoom and lifecycle tests; shared Character defaults and key/adjacency contract.
- Existing G1 verification: Node 26.13.0 typecheck, 114 tests and real SDK/two-Land smoke pass; browser Enter/Leave/re-entry and screenshot pass.
- SQLite runtime evidence from docs/spikes/loopback-bridge.md.

## Decisions
1. Use built-in node:sqlite with one LandStore per map-server process; no new package/dependency. A per-Land SQLite file replaces ephemeral stats/inventory in the local game startup.
2. Bind the database to the configured public Land key and fail on a different key, unsupported schema, corrupt state or failed migration. This prevents accidentally loading another Land's state from a reused directory. New Lands use independent directories/defaults.
3. Schema version 1 creates only public Land metadata and per-Player stats/inventory. WAL and synchronous=FULL are set before serving. Migrations and writes use explicit transactions.
4. Load/create state on join and commit snapshots on leave/dispose. Current G1 has no gameplay stat/inventory mutation commands; future gameplay mutations must write durably before acknowledging changes. Do not add unrequested gameplay actions or a network state-edit API.
5. Keep LandStore optional only for existing isolated room unit tests. The real main entry point always opens the file-backed store before listening.
6. Keep the server's loopback/production refusal intact. Admission, invite authority, restore epochs, owner admin idempotency and recovery bundles remain T07/G4 work; a G2 stats file grants no membership/admission rights.
7. Update the client text and existing docs to describe Land-local persistence accurately. Smoke tests use isolated temporary data directories, with verified bounded cleanup.

## Trade-offs
- Snapshot-on-leave/dispose is sufficient for the current game, which has no stat/inventory mutations. It is not a write-through persistence guarantee for future gameplay actions; those must use the store at the action boundary.
- Schema version 1 is an additive starting point for T07's forward migrations. No rights/secret/reward state is invented to preempt T07.
- SQLite remains synchronous because current mutations are small and serialized; no queue/service abstraction is needed.

## Files to create / modify
- packages/map-server/src/land-store.ts: SQLite migration, Land binding, state validation, transactions and lifecycle.
- packages/map-server/src/land-store.test.ts: restart, isolation, schema/corruption/write-failure and no-gold checks.
- packages/map-server/src/config.ts and config.test.ts: LAND_DATA_DIR and per-Land default directory.
- packages/map-server/src/main.ts: open database before listening and close on process exit.
- packages/map-server/src/LandRoom.ts and lifecycle tests: load/save state via the configured store.
- packages/map-server/scripts/local-smoke.ts: isolated temporary storage for executable smoke tests.
- packages/client/index.html: describe persistence accurately.
- Existing README/map-server README/docs/connect-g1.md: record G2 behavior and verified boundaries.

## Build sequence
1. Add the store and focused SQLite tests under the measured Node 26 runtime.
2. Integrate real startup and room lifecycle, then test leave/rejoin and reopen persistence.
3. Verify failure paths and Land isolation; run typecheck/lint/test and executable two-Land smoke.
4. Review and try to break the changed boundaries twice; fix any findings and rerun affected checks.
5. Run the client and capture a screenshot after the text change. No remote push/deploy is authorized.

## Open questions
- Public protocol namespace/license/publication remains pending independently of G2.
- Linux pinned-runtime SQLite/restore evidence is owned by T07/T10, not claimed by the Windows G2 checks.

## Verification recorded 2026-11-01
- Focused store/room/config checks: 33 tests pass.
- Full Node 26.13.0 typecheck/lint and 124 game tests pass; real main/SDK and two-Land smoke pass.
- Review 1: traced startup/config/store/room and fault paths; fixed disposal after failed room creation.
- Review 2: tested schema/identity mismatch, corrupt state, aborted SQLite writes and prototype-shaped keys; no gold/secret tables or reset-on-error path.
- Final native browser Enter/Leave/re-entry, zero page errors/external requests and screenshot passed on the real G2 SQLite startup.
