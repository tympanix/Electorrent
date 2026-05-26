---
name: deluge-api
description: >
  Deluge Web JSON-RPC and core RPC reference covering session login, web
  methods, and commonly used core torrent operations.
---

# Skill: Deluge API

## Purpose

Use this skill when you need to integrate with Deluge Web or reason about Deluge RPC calls exposed through the Web UI.

## Protocols

### Web API

- Endpoint: `/json`
- Spec: JSON-RPC v1-style request body
- Typical request body:

```json
{
  "method": "web.update_ui",
  "params": [["name", "progress"], {}],
  "id": 1
}
```

- File uploads are sent to `/upload`

### Core daemon RPC

DelugeRPC is the daemon/client wire protocol. Messages are zlib-compressed, rencode-encoded payloads.

- Request: `[[request_id, method, [args], {kwargs}], ...]`
- Response: `[message_type, request_id, [return_value]]`
- Error: `[message_type, request_id, exception_type, exception_msg, traceback]`
- Event: `[message_type, event_name, data]`

The Web UI exposes many core methods directly through the JSON endpoint, so callers often use JSON requests with `core.*`, `auth.*`, and `web.*` method names.

## Session flow

Typical Web UI flow:

1. `auth.login(password)`
2. `web.get_hosts()`
3. `web.connect(host_id)`
4. Use `web.*` and `core.*` methods against the connected daemon

## Main Web methods

| Method | Parameters | Purpose |
|---|---|---|
| `web.add_host` | `host, port, username='', password=''` | Add daemon to host list |
| `web.edit_host` | `host_id, host, port, username='', password=''` | Edit host entry |
| `web.remove_host` | `host_id` | Remove host entry |
| `web.get_hosts` | none | Return configured hosts |
| `web.get_host_status` | `host_id` | Get daemon status |
| `web.connect` | `host_id` | Connect Web UI to a daemon |
| `web.connected` | none | Check connected state |
| `web.disconnect` | none | Disconnect current daemon |
| `web.get_events` | none | Drain queued events |
| `web.register_event_listener` | `event` | Subscribe to event queue |
| `web.deregister_event_listener` | `event` | Remove subscription |
| `web.get_config` | none | Read Web UI config |
| `web.set_config` | `config` | Update Web UI config |
| `web.set_theme` | `theme` | Change theme |
| `web.get_plugins` | none | Available/enabled Web UI plugins |
| `web.get_plugin_info` | `name` | Plugin details |
| `web.get_plugin_resources` | `name` | Plugin resource files |
| `web.upload_plugin` | `filename, path` | Upload plugin |
| `web.download_torrent_from_url` | `url, cookie=None` | Download torrent to temp path |
| `web.get_magnet_info` | `uri` | Parse magnet metadata |
| `web.get_torrent_info` | `filename` | Inspect torrent file on disk |
| `web.get_torrent_files` | `torrent_id` | Torrent files tree |
| `web.get_torrent_status` | `torrent_id, keys` | Selected torrent fields |
| `web.update_ui` | `keys, filter_dict` | Incremental UI snapshot |
| `web.add_torrents` | `[{path, options}]` | Add uploaded/downloaded torrent files |

## Core methods commonly used through Web API

| Method | Parameters | Purpose |
|---|---|---|
| `core.get_config_values` | `[keys]` | Read daemon config such as `download_location` |
| `core.resume_torrent` | `[hashes]` | Resume torrents |
| `core.pause_torrent` | `[hashes]` | Pause torrents |
| `core.force_recheck` | `[hashes]` | Recheck torrents |
| `core.remove_torrent` | `[hash, remove_data]` | Remove torrent, optionally deleting data |
| `core.queue_up` | `[hashes]` | Move up in queue |
| `core.queue_down` | `[hashes]` | Move down in queue |
| `core.queue_top` | `[hashes]` | Move to top |
| `core.queue_bottom` | `[hashes]` | Move to bottom |

## Important request and response details

- `web.connect(host_id)` returns the list of methods the daemon supports
- `web.update_ui(keys, filter_dict)` returns torrent/UI data keyed by torrent hash
- `web.add_torrents()` expects uploaded files to be referenced by temporary `path`
- `web.download_torrent_from_url()` returns the temporary filename to pass into `web.add_torrents()`
- `web.get_torrent_info()` returns `name`, `files_tree`, and `info_hash`

## Common options for `web.add_torrents`

Common per-torrent options include:

- `download_location`
- `file_priorities`
- `add_paused`
- `compact_allocation`
- `max_connections`
- `max_download_speed`
- `max_upload_slots`
- `max_upload_speed`
- `prioritize_first_last_pieces`

## Electorrent usage

Electorrent uses:

- `auth.login`
- `web.get_hosts`
- `web.connect`
- `web.update_ui`
- `web.download_torrent_from_url`
- `web.add_torrents`
- `core.get_config_values`
- `core.resume_torrent`
- `core.pause_torrent`
- `core.force_recheck`
- `core.remove_torrent`
- `core.queue_up`, `core.queue_down`, `core.queue_top`, `core.queue_bottom`

## References

- https://deluge.readthedocs.io/en/latest/reference/webapi.html
- https://deluge.readthedocs.io/en/latest/reference/rpc.html
