# linked-realms

A game of player-hosted Lands. This Connect G1/G2 build starts locally with a **fake agent-key test adapter**, validated map data and local Character defaults. It needs no wallet, RPC, ticket, contract deployment, PostgreSQL or Hub service.

Use Node.js 26 and pnpm 11.3.0. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @linked-realms/map-server start
# In another terminal:
pnpm --filter @linked-realms/client dev
```

Open http://127.0.0.1:5181 and click **Enter local Land**. Move with WASD or arrow keys. The default synthetic Player key is the configured local Land owner's key. To test a visitor, set `VITE_TEST_PLAYER_KEY` to a different 64-character lowercase hexadecimal string before starting Vite.

This adapter accepts public-key assertions without proof of possession. It is only a local development tool: the server binds to 127.0.0.1 and refuses `NODE_ENV=production`. Do not expose it through a proxy. G4 replaces it with agent-owned admission; this is not a public Connect release.

- `packages/shared`: game rules, map validation, movement, version-1 adjacency/LandMessage and unavailable gold interface.
- `packages/map-server`: one Colyseus room, at most 64 Players, authoritative movement and 30 input messages/second per session.
- `packages/client`: Phaser rendering and the ordinary, unpatched Colyseus SDK.

New Players start with four Character stats at 1 and an empty inventory. G2 stores stats/inventory by Player in this Land's SQLite file and restores them on later joins/restarts. Another Land starts with its own defaults. Set `LAND_DATA_DIR` to choose the directory; the default is `.data/<land-key>/` under this checkout. G3 supplies signed profiles. Gold is visibly unavailable and spending fails closed until C4; no gold table, ledger or mint path exists. Mining is disabled; C3 owns the separate opt-in agent miner.

See [the G1/G2 contract and boundaries](docs/connect-g1.md) for schema, fixtures, gold and follow-up integration. [Local hosting](docs/self-hosting.md) documents configuration. Historical EVM plans and ADRs are retained as history and do not describe this build.

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @linked-realms/map-server e2e
pnpm e2e:world
```

The smoke commands launch real local Map server entry points, then join and move using the SDK without external services. They do not test real agent admission, encryption, browser rendering or inter-Land travel. `docker compose up --build --abort-on-container-exit --exit-code-from game-test` runs the reciprocal fixture smoke with container networking disabled.
