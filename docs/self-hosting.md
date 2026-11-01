# Local Connect development

G1/G2 runs only a local test adapter. Public hosting requires the later agent admission integration (G4); the adapter asserts public keys without verifying them. Never publish its port or proxy it to other machines.

Install Node.js 26 and pnpm 11.3.0, then use the commands in the [README](../README.md). The Map server reads exported environment variables, not `.env` automatically; Vite loads its package-local environment file normally.

| Setting | Default | Meaning |
| --- | --- | --- |
| `LAND_COLYSEUS_PORT` | `2567` | Integer 1-65535 |
| `LAND_OWNER_PLAYER_KEY` | 32 bytes of `11`, lowercase hex | Public test owner key |
| `LAND_ADJACENCY_FILE` | Synthetic Land `aa` repeated 32 times, no neighbors | Bounded strict version-1 JSON; malformed config fails before listening |
| `LAND_DATA_DIR` | Repository `.data/<land-key>/` | Per-Land directory for `land.db`; do not reuse a Land's database for another key |
| `MAP_FILE` | Repository `maps/empty-land.json` | Validated Tiled map |
| `HOST` | `127.0.0.1` | Every other value is refused |
| `NODE_ENV` | unset | `production` is refused |
| `VITE_TEST_SERVER_URL` | `http://127.0.0.1:2567` | Client-only loopback endpoint |
| `VITE_TEST_PLAYER_KEY` | Same synthetic owner key | Client-only fake identity |

To inspect two Lands locally, generate files with `pnpm --filter @linked-realms/map-server seed:world`, then start each with a different port and its generated `adjacency.json` via `LAND_ADJACENCY_FILE`. Point Vite at either port. The topology is reciprocal but the UI does not perform agent travel yet.

The Docker image is also a local test tool. `docker compose up --build --abort-on-container-exit --exit-code-from game-test` runs the finite two-Land SDK smoke entirely on container loopback with networking disabled. For interactive play, use the native commands; no exposed container listener is provided by G1.

There are no Player/Land private credentials in this local game build. G2 stores stats/inventory in `land.db`; leave the Land and stop the process before copying local test data, or use SQLite backup tools. Do not copy a live database without its WAL. Production recovery bundles/epoch checks belong to T07/agent integration and are not implemented by this stats store. Gold never falls back to SQLite. Production agent/Hub packaging, signed profiles, invites and recovery are not implemented here.
