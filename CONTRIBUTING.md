# Contributing

The project owner reviews and merges every pull request. Nothing reaches `main` without a pull request.

- Read [Connect G1](docs/connect-g1.md) and [CONTEXT.md](CONTEXT.md). Older EVM plans/ADRs are historical; do not restore their authority or startup dependencies.
- Keep code, comments and documentation in English.
- Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and both SDK smoke commands in the README.
- New behavior needs meaningful tests. Keep map/input limits, configured owner authority and voluntary resource use.
- Never commit seeds, private keys or credentials. Use synthetic public identifiers for local fixtures.
- No gold ledger, local balance fallback or mint path. C4 supplies chain integration through the gold seam.
- Public game builds must not import private Hub source. G4 must pin the public Connect package, without copying its codecs.
- Do not deploy or merge without the owner's instruction.
