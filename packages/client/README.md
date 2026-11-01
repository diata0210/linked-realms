# Game client

Run `pnpm --filter @linked-realms/client dev` from the repository root, then open http://127.0.0.1:5181. Start the Map server in another terminal. No wallet extension, account, chain RPC or ticket is needed.

`VITE_TEST_SERVER_URL` defaults to `http://127.0.0.1:2567` and accepts only loopback HTTP. `VITE_TEST_PLAYER_KEY` defaults to the synthetic owner identifier shown in `.env.example`. These are public test identifiers, not cryptographic proof of identity.

The client validates maps and the shared LandMessage adjacency, renders Players by key and displays missing destinations as disabled Gates. Known neighbor keys are shown, but agent-driven travel is deferred to G4. No browser private keys, profile-signature implementation or Connect wire codec is included.

Build with `pnpm build`; this produces a local test UI, not a production admission system. See [G1 boundaries](../../docs/connect-g1.md).
