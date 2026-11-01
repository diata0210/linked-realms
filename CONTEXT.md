# linked-realms terminology

- **Land**: a player-hosted game space identified by a global agent public key; map data remains a validated 64-by-64 tile grid.
- **Land owner**: the configured `owner_player_key`, never a client-supplied flag or wallet address.
- **Player**: identified by one global Ed25519 agent key. G1 uses only fake public-key assertions for local tests.
- **Character**: the Player's in-game representation. Stats/inventory are per-Land/per-key; G2 adds persistence.
- **Gate**: an edge passage with an optional neighbor Land key. Missing adjacency disables travel; topology is not admission authority.
- **Map server**: Node/Colyseus process running one Land's game simulation.
- **Agent**: separate public Connect software holding keys and owning admission/transport. G1 does not implement it.
- **Hub**: an independent directory and encrypted relay service; it cannot admit Players. Its operator implementation is outside this repository.
- **Gold**: chain-owned portable currency. G1 exposes an unavailable interface, never a local ledger. C4 supplies chain balance and authorized transfer integration.
- **Mine**: the map's mining location. G1 runs no miner; later agent mining must be explicit, opt-in and bounded.

Wallet/SIWE/Travel ticket/Delegation/NFT terminology in older plans describes the retired EVM implementation only.
