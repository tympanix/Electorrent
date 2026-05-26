---
name: transmission-api
description: >
  Transmission RPC reference covering JSON-RPC 2.0 transport, session token
  handling, torrent methods, session methods, and protocol versioning.
---

# Skill: Transmission API

## Purpose

Use this skill when you need to integrate with Transmission's RPC API.

## Protocol

- Preferred transport: HTTP `POST`
- Default endpoint: `http://host:9091/transmission/rpc`
- Current spec: JSON-RPC 2.0
- Request parameters must be an object in `params`
- Response data is returned in `result`

Example request:

```json
{
  "jsonrpc": "2.0",
  "params": {
    "fields": ["version"]
  },
  "method": "session_get",
  "id": 1
}
```

## Authentication and session token

### CSRF token

Most servers require `X-Transmission-Session-Id`.

- First request often gets `409 Conflict`
- The response includes the correct `X-Transmission-Session-Id`
- Retry the same request with that header value

### Authentication

- Optional HTTP Basic Auth
- Credentials are sent in `Authorization: Basic ...`

## Method naming

- Transmission 4.1.0+ (`rpc_version_semver` 6.0.0+) uses JSON-RPC 2.0 and `snake_case`
- Older bespoke protocol and older `kebab-case` / `camelCase` strings are deprecated but still seen in existing clients

## Torrent methods

### Action methods

- `torrent_start`
- `torrent_start_now`
- `torrent_stop`
- `torrent_verify`
- `torrent_reannounce`

Common parameter:

- `ids`: integer id, array of ids/hashes, or `"recently_active"`

### `torrent_get`

Request:

- optional `ids`
- required `fields`
- optional `format`: `objects` or `table`

Important field families:

- core status: `id`, `hash_string`, `name`, `status`, `percent_done`, `eta`, `eta_idle`
- storage: `download_dir`, `files`, `file_stats`, `wanted`, `priorities`, `piece_count`, `piece_size`, `pieces`
- transfer: `rate_download`, `rate_upload`, `uploaded_ever`, `downloaded_ever`, `upload_ratio`
- peers/trackers: `peers`, `peers_from`, `trackers`, `tracker_stats`, `webseeds_ex`
- queue and policy: `queue_position`, `seed_ratio_limit`, `seed_idle_limit`, `labels`, `group`, `sequential_download`

Status values:

| Value | Meaning |
|---|---|
| 0 | stopped |
| 1 | queued to verify |
| 2 | verifying |
| 3 | queued to download |
| 4 | downloading |
| 5 | queued to seed |
| 6 | seeding |

### `torrent_set`

Common mutators:

- `download_limit`, `download_limited`
- `upload_limit`, `upload_limited`
- `peer_limit`
- `files_wanted`, `files_unwanted`
- `priority_high`, `priority_normal`, `priority_low`
- `location`
- `queue_position`
- `labels`
- `group`
- `seed_ratio_limit`, `seed_ratio_mode`
- `seed_idle_limit`, `seed_idle_mode`
- `sequential_download`
- `sequential_download_from_piece`
- `tracker_list`

### `torrent_add`

Supply either:

- `filename` for URL or `.torrent` path
- `metainfo` for base64-encoded `.torrent` bytes

Useful optional parameters:

- `download_dir`
- `paused`
- `labels`
- `peer_limit`
- `files_wanted`, `files_unwanted`
- `priority_*`
- `sequential_download`
- `sequential_download_from_piece`

Success returns `torrent_added`; duplicate adds return `torrent_duplicate`.

### Other torrent methods

- `torrent_remove`
  - params: `ids`, `delete_local_data`
- `torrent_set_location`
  - params: `ids`, `location`, `move`
- `torrent_rename_path`
  - params: `ids` (single torrent), `path`, `name`

## Session methods

### `session_get` / `session_set`

Important keys:

- networking: `peer_port`, `port_forwarding_enabled`, `preferred_transports`, `encryption`
- directories: `download_dir`, `incomplete_dir`, `incomplete_dir_enabled`
- queues: `download_queue_enabled`, `download_queue_size`, `seed_queue_enabled`, `seed_queue_size`
- speed limits: `speed_limit_down`, `speed_limit_down_enabled`, `speed_limit_up`, `speed_limit_up_enabled`
- alternate speeds: `alt_speed_*`
- seeding policy: `seed_ratio_limit`, `seed_ratio_limited`, `idle_seeding_limit`, `idle_seeding_limit_enabled`
- versioning: `rpc_version_semver`, `version`

### Other session methods

- `session_stats`
- `blocklist_update`
- `port_test`
- `session_close`
- `free_space`
- queue movement: `queue_move_top`, `queue_move_up`, `queue_move_down`, `queue_move_bottom`
- bandwidth groups: `group_set`, `group_get`

## Error object

JSON-RPC errors may include:

- `code`
- `message`
- `data.error_string`
- `data.result`

## Versioning

- Prefer `rpc_version_semver` for compatibility checks
- `rpc_version` and `rpc_version_minimum` are deprecated
- `X-Transmission-Rpc-Version` may be returned on HTTP 409 responses on newer servers

## Electorrent usage

Electorrent currently talks to Transmission using the legacy method names:

- `session-get`
- `torrent-get`
- `torrent-add`
- torrent action methods such as start/stop/remove

That works on current Transmission releases, but new integrations should prefer the JSON-RPC 2.0 `snake_case` forms from this spec.

## Reference

- https://raw.githubusercontent.com/transmission/transmission/refs/heads/main/docs/rpc-spec.md
