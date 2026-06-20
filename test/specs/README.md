# Test spec groups

Specs are grouped by the client capabilities they require:

- `standard/` — specs that run against the normal bittorrent client matrix.
- `mock/` — specs that require the mock client/runtime and should only be listed by the mock test client capability.

Add new specs to the narrowest applicable group. If a spec is only meaningful for a purpose-built test client, keep it out of `standard/` and wire it through that client's `specs` entry in `test/clients/*/index.ts`.
