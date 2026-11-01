# Map server

`pnpm --filter @linked-realms/map-server start` starts the G1/G2 local test adapter at 127.0.0.1:2567 using `maps/empty-land.json`. No external service or credential is required.

Configuration and limits are documented in [local hosting](../../docs/self-hosting.md). The adapter accepts a synthetic Player key, never a ticket. Owner status comes only from `LAND_OWNER_PLAYER_KEY`, held outside client-merged room options. This is not authentication: anyone local can assert that public key. Production startup is refused until G4.

One room, 64 seats, 30 inputs/second per session, 4096-byte inbound WebSocket payloads, compression off and no development reconnect are retained. G2 persists per-Player stats/inventory in `LAND_DATA_DIR/land.db` (default `.data/<land-key>/`), with WAL, synchronous FULL and transactional schema version 1. The database is bound to its public Land key; a different key, unsupported schema or storage failure is refused. Gold is not room or database state.

`pnpm --filter @linked-realms/map-server seed:world [output-directory]` generates validated local maps and adjacency for two reciprocal Lands. `e2e` probes default startup; `e2e:world` consumes both shared fixtures. These scripts use the real entry point and ordinary SDK, with no Hub or RPC.

Current gameplay has no stat/inventory mutation commands. Room leave/dispose commits snapshots; later gameplay actions must commit through LandStore before acknowledging a mutation. The real entry point always opens storage before listening. Existing isolated room tests may omit the store. Invite/admission authority, restore epochs and matched recovery bundles remain T07/G4 responsibilities.
