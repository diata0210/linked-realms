# Connect G1/G2: local game boundary

G1 removes the retired EVM implementation from this public game repository. The workspace now contains only client, map-server and shared game packages. It starts with a **fake local agent-key adapter** and no external service. This document records the implemented game-side contract; it is not a Connect wire specification or a production admission claim.

## Removed and preserved

Removed: Solidity contracts/ABIs/deployments, EVM mining and indexer packages, SIWE/TS Hub/plaintext relay, wallet/passkey/NFT client code, contract-gold authority, ticket/delegation helpers, EVM seeding/deployment/CI and their exclusive lockfile dependencies. No legacy compatibility exports remain.

Preserved: validated Tiled maps and their generator, map/input bounds, collision and movement, Phaser rendering, pure world/Gate geometry, character default rules, ordinary Colyseus SDK/server/WebSocket transport, one room per process, 64 seats, 30 inputs/second per session and configured owner status. Inbound WebSocket payloads are capped at 4096 bytes, compression is off and development reconnect is disabled. Historical plans/ADRs remain as history, subject to the current README and this boundary.

## Local test identity and state

`packages/shared/src/local-test.ts` defines synthetic public identifiers, not private seeds. `JoinOptions.playerKey` is accepted only as an unverified assertion for local development. The default Player is `11` repeated 32 times and the default Land is `aa` repeated 32 times with no neighbors. No private key is generated, persisted, signed or exported in TypeScript. G2 stores public Player/Land identifiers with their game state.

The entry point uses local configuration, binds to 127.0.0.1 and rejects production mode. A public proxy would defeat this local-only boundary and is not supported. Room configuration stays in a server closure rather than Colyseus's client-merged options. Owner status comes from `LAND_OWNER_PLAYER_KEY`; a local caller can still impersonate any key because the adapter is deliberately fake.

G2 stores public Land metadata plus per-Player stats/inventory in `LAND_DATA_DIR/land.db`, defaulting to `.data/<land-key>/` in the repository. A new Player starts with all shared stat keys at 1 and empty inventory; a later join reads the same Land-local state. Another Land uses another database/defaults. The database refuses a mismatched Land key, unsupported/unversioned existing schema and corrupt state; it never converts corrupt records to defaults. WAL, synchronous=FULL, ordered transactional schema initialization and transaction rollback protect committed writes. A storage error latches the store closed until reopen.

Current gameplay has no stat/inventory mutation messages. Room leave/dispose commits snapshots, and LandStore.save is the server-side durable mutation boundary; future gameplay mutations must call it before acknowledging changes. There is no local gold state. This stats-only schema grants no admission rights: invites, bans, owner idempotency, restore epochs and complete recovery bundles still belong to T07/G4.

## Shared adjacency and LandMessage

The game-owned schema in `packages/shared/src/adjacency.ts` is exactly:

```ts
{
  version: 1,
  landKey: string, // exactly 64 lowercase hexadecimal characters (32 bytes)
  neighbors: {
    north?: string,
    east?: string,
    south?: string,
    west?: string
  }
}
```

`LandMessage` aliases this shape and `parseLandMessage` uses the same validator. `LAND_ADJACENCY_FILE` is JSON parsed with `parseAdjacencyJson`: maximum 2048 UTF-8 bytes, exact fields, no unknown version/direction, malformed key, self-neighbor or duplicate field (including escaped duplicate names). The client validates the decoded room message before using it. The local world generator uses the same parser. Missing directions disable Gate travel; coordinates never imply neighbors or admission.

`packages/shared/fixtures/two-lands/land-a.json` (`aa` repeated) points east to `land-b.json` (`bb` repeated), which points west to A. `arrivalGate` is the shared opposite-Gate helper. `reciprocalArrival` checks both topology records and returns a direction only for a reciprocal relationship. G4 must separately verify source/destination and admission before using an arrival hint. In G1 every client arrival hint is unverified and uses normal spawn, even if the caller claims verification. The UI identifies configured neighbor keys but does not perform production agent travel.

Run `pnpm --filter @linked-realms/map-server seed:world [output-directory]` to generate both validated local maps and adjacency files. It creates no identity, wallet, database or credentials.

## Gold seam for C4

`packages/shared/src/gold.ts` exports `GoldService` with `balance(playerKey)` and `spend(playerKey, units, reference)`. This is a narrow game-facing placeholder, not an agent wire API. The `unavailableGold` implementation always returns `{status: "unavailable"}` without a fabricated zero balance and rejects every spend. The client renders that unavailable state. No mint/credit operation, gold table, ledger, balance cache or SQLite fallback exists.

C4 must supply chain units, wallet resolution, explicit spend authorization, idempotency, pending/stale/reorg reconciliation and Land rewards from the Land wallet through the agent's structured reward API. A reference in this stub does not claim implemented idempotency. C3 owns opt-in agent mining; no legacy mining code or background worker remains in this build.

## Integration ownership

- G2 implemented locally: per-Land/per-key stats/inventory; no gold database or admission authority.
- G3: original signed profiles and verification through the pinned public Connect package.
- G4: replace fake assertions with verified agent admission/capabilities/generations, fresh joins and verified travel. Consume the schema and fixtures here. No private Hub source, copied Connect codecs or TypeScript Noise engine.
- C4: implement the gold seam and chain-specific tests independently from Connect startup.

No public Connect package version/hash is invented here. Pin the actual public release when integration consumes it. No Hub or Connect repository was modified.

## Original G1 verification in this worktree

On Windows with Node 24.16.0 and pnpm 11.3.0 (the repository/CI still requires Node 26):

- `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test`: pass, 114 tests across 16 files.
- `pnpm build`: pass; Vite reports the existing large Phaser bundle warning.
- `pnpm --filter @linked-realms/map-server e2e`: pass; the real default entry point sends map/topology/local Character state and accepts movement through the unpatched SDK without RPC/wallet/ticket.
- `pnpm e2e:world`: pass for each reciprocal fixture's real entry point; this is not a real-agent inter-Land travel test.
- `pnpm --filter @linked-realms/map-server seed:world D:/tmp/g1/world`: pass.

The first online `pnpm install --frozen-lockfile` failed with registry `EACCES`. Cached dependencies were installed using pnpm offline and exact existing lockfile resolutions. Removed importers and unreachable package entries were pruned without changing any retained version or integrity hash; pnpm accepted the resulting frozen lockfile. During offline installation only, metadata-age/trust lookups were temporarily disabled locally because those lookups still requested the blocked registry; these temporary settings are not in the final repository. Subsequent commands used `pnpm_config_verify_deps_before_run=false` in the process environment to run the installed tools without pnpm automatically retrying network installation. Normal CI retains the package manager defaults.

Not verified: Node 26 execution, Linux, real browser rendering/input, Docker image/compose execution (WSL returned `E_ACCESSDENIED`), real agent/Hub/Land admission/travel, signed profiles, restart persistence or chain settlement. Foundry tests no longer apply because the retired contracts are deleted. Public CI now runs game checks and local smoke without chain/Postgres/private Hub services.

Owner follow-up: if branch protection still requires the removed `contracts` CI job, update that requirement to the retained game checks. G1 itself needs no further owner decision; production integration/release remains outside this task.

## Codex takeover and G2 verification, 2026-11-01

- Measured runtime: existing Node 26.13.0 on Windows, used directly for both package tools and spawned game servers.
- Full typecheck/lint and 124 tests pass: shared 63, client 28, map-server 33. New coverage includes reopen persistence, independent Lands/Players, unsupported schema, corrupt state, failed-write rollback/fail-closed, prototype-shaped own keys and actual room leave/rejoin persistence.
- Real main entry point / unpatched SDK and reciprocal two-Land smoke pass with isolated temporary data directories. These are local fake-adapter tests, not encrypted Hub/agent admission.
- Real browser Enter/Leave/re-entry and rendering passed during takeover; no page errors or external/RPC requests. Screenshot evidence is kept in local scratch, outside public source.
- T02 independently repaired and verified in public Connect; its public release pins are still owner-gated. No release version is invented here.
- Linux runtime, Docker execution, signed profiles, real agent/Hub integration and production recovery remain separate unverified tasks. The old G1-only caveats above are historical; Node 26/browser and G2 persistence now have the evidence stated here.
