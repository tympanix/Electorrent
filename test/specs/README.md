# Test spec groups

Specs are grouped by the client capabilities they require:

- `standard/` — specs that run against the normal bittorrent client matrix.
- `mock/` — specs that require the mock client/runtime and should only be listed by the mock test client capability.

Add new specs to the narrowest applicable group. If a spec is only meaningful for a purpose-built test client, keep it out of `standard/` and wire it through that client's `specs` entry in `test/clients/*/index.ts`.

## Concurrency

Set `ELECTORRENT_TEST_CONCURRENCY` to run specs concurrently for each Docker-backed client capability. Each worker receives an isolated Docker Compose project; projects are reused as later specs are scheduled, so specs never share mutable client state and a full stack is not started per spec. Non-Docker capabilities remain serial because they do not use the fixture pool. The default is `1`, and supported values are `1` through `4`.

For example:

```shell
ELECTORRENT_TEST_CONCURRENCY=2 npm test -- --client qbittorrent:latest --headless
```
