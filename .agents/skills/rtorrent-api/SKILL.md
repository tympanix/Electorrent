---
name: rtorrent-api
description: >
  rTorrent XML-RPC command reference focused on remote control, multicall
  patterns, load methods, and the torrent commands used by Electorrent.
---

# Skill: rTorrent API

## Purpose

Use this skill when you need to integrate with rTorrent over XML-RPC.

## Protocol

- Transport: XML-RPC over HTTP(S)
- Common path: `/RPC2`
- Command names are the API surface, for example `d.multicall2` or `load.start`
- Prefer modern dotted command names from rTorrent 0.9+; deprecated aliases like `load_start`, `d.get_name`, or `get_download_rate` still appear in old examples but should not be used for new integrations

## Command model and calling conventions

- rTorrent exposes both variables and commands
  - read a value with the variable-like command name, for example `d.name`
  - mutate with a `.set` command, for example `d.priority.set`
- Multicall selector strings usually need a trailing `=`
  - example: `d.multicall2("", "main", "d.hash=", "d.name=", "d.custom1=")`
  - keyed accessors also follow that shape, for example `d.custom=addtime`
- All torrent-scoped `d.*` calls take the torrent info hash as the first XML-RPC argument

Example shape:

```text
d.name = <hash> -> string
```

- Common scoped patterns:
  - `t.multicall(<hash>, "", ...)` for trackers on one torrent
  - `f.multicall(<hash>, "", ...)` for files on one torrent
  - `p.multicall(<hash>, "", ...)` for peers on one torrent
- Batch unrelated calls with `system.multicall([{ methodName, params }...])`

## Important command groups

| Group | Purpose | Important examples |
|---|---|---|
| `d.*` | Torrent/download fields and actions | `d.multicall2`, `d.name`, `d.state`, `d.start`, `d.stop`, `d.erase` |
| `t.*` | Tracker fields and tracker multicalls | `t.multicall`, `t.url`, `t.scrape_complete`, `t.is_enabled` |
| `f.*` | File fields and file priority | `f.multicall`, `f.path`, `f.size_bytes`, `f.priority.set` |
| `p.*` | Peer inspection | `p.multicall`, `p.address`, `p.client_version`, `p.down_rate` |
| `load.*` | Add torrents and magnet links | `load.normal`, `load.start`, `load.raw_start`, verbose variants |
| `view.*` | Named views for listing/filtering/sorting torrents | `view.list`, `view.add`, `view.filter`, `view.sort` |
| `session.*` | Session path/name/save behavior | `session.path`, `session.name`, `session.save` |
| `method.*`, `schedule2`, `event.*` | Scripting, dynamic methods, scheduling | `method.insert`, `method.set_key`, `schedule2` |
| `execute.*`, `system.*` | Host/system interaction | `execute.throw`, `execute.capture`, `system.client_version`, `system.shutdown.normal` |
| `network.*`, `protocol.*`, `throttle.*`, `dht.*`, `pieces.*` | Connectivity, encryption, limits, DHT, piece behavior | `network.port_range`, `protocol.encryption.set`, `throttle.global_down.max_rate.set`, `dht.mode.set` |
| `directory.*`, `group*.seeding.ratio.*` | Default save path and seeding ratio policy | `directory.default.set`, `group.seeding.ratio.enable`, `group2.seeding.ratio.max.set` |

## Commands commonly used for remote clients

### Connection and capability

- `system.client_version`
- `system.api_version` if present on the target
- `view.list`
  - enumerate named views such as `main`

### Torrent listing

- `d.multicall2("", "main", ...)`
  - query many torrent fields at once from the `main` view
- `system.multicall([...])`
  - batch heterogeneous XML-RPC calls

Common listing fields for remote UIs:

- identity/path: `d.hash`, `d.name`, `d.base_path`, `d.directory`, `d.tied_to_file`, `d.loaded_file`
- size/progress: `d.size_bytes`, `d.completed_bytes`, `d.left_bytes`, `d.completed_chunks`, `d.chunk_size`
- state/rates: `d.is_active`, `d.is_open`, `d.complete`, `d.state`, `d.down.rate`, `d.up.rate`, `d.down.total`, `d.up.total`
- swarm/tracker summary: `d.peers_accounted`, `d.peers_complete`, `d.tracker_size`, `d.tracker_numwant`
- metadata/custom fields: `d.message`, `d.custom1`, `d.custom=addtime`

### Tracker listing

- `t.multicall(<hash>, "", ...)`
  - query trackers for one torrent

Important tracker fields:

- `t.url`
- `t.group`
- `t.type`
- `t.is_enabled`
- `t.is_open`
- `t.min_interval`
- `t.normal_interval`
- `t.scrape_complete`
- `t.scrape_downloaded`
- `t.scrape_incomplete`
- `t.scrape_time_last`

### File and peer listing

- `f.multicall(<hash>, "", ...)`
  - query per-file path, size, progress, and priority
- `p.multicall(<hash>, "", ...)`
  - query live peer state when needed

Important file fields:

- `f.path`
- `f.size_bytes`
- `f.completed_chunks`
- `f.size_chunks`
- `f.priority`
- `f.priority.set`

Important peer fields:

- `p.address`
- `p.port`
- `p.client_version`
- `p.completed_percent`
- `p.down_rate`
- `p.up_rate`

### Adding torrents

- `load.normal("", <uri>)`
  - add without starting
- `load.start("", <uri>)`
  - add from URL or magnet and start
- `load.raw("", <torrent-bytes>)`
  - add raw torrent data without starting
- `load.raw_start("", <torrent-bytes>)`
  - add from raw torrent bytes and start
- `load.verbose`, `load.start_verbose`, `load.raw_verbose`
  - verbose load variants also exist on some targets

If a save location must be set at add time, pass it in the initial `load.*` call:

- `d.directory.set=<json-encoded-path>`

Changing the directory after load is not equivalent for Electorrent's rTorrent flow.

### Start/stop lifecycle

- `d.open(<hash>)`
- `d.start(<hash>)`
- `d.stop(<hash>)`
- `d.close(<hash>)`

Typical start sequence:

1. `d.open`
2. `d.start`

Typical stop sequence:

1. `d.stop`
2. `d.close`

### Removal and recheck

- `d.erase(<hash>)`
- `d.delete_tied(<hash>)`
- `d.check_hash(<hash>)`

Common related fields:

- `d.hashing`
- `d.hashing_failed`
- `d.state_changed`
- `d.timestamp.started`
- `d.timestamp.finished`

### Labels and priority

- `d.custom1.set(<hash>, <label>)`
- `d.custom.set(<hash>, <key>, <value>)`
- `d.custom1` ... `d.custom5`
- `d.priority.set(<hash>, <0-3>)`

Priority values commonly used by clients:

| Value | Meaning |
|---|---|
| `0` | off / do not download |
| `1` | low |
| `2` | normal |
| `3` | high |

### Host-side filesystem helper

- `execute.throw("", "mkdir", "-p", <path>)`
  - create download directories before loading a torrent

Useful related execution/system commands:

- `execute2`, `execute.nothrow`, `execute.capture`
- `execute.*.bg` background variants
- `system.file.allocate`
- `system.shutdown.normal`
- `system.shutdown.quick`

### Session, view, and settings commands

Useful server/session inspection:

- `session.path`
- `session.name`
- `session.save`
- `directory.default`
- `directory.default.set`

Useful network/rate settings often surfaced by remote clients:

- `throttle.global_down.max_rate`
- `throttle.global_down.max_rate.set`
- `throttle.global_up.max_rate`
- `throttle.global_up.max_rate.set`
- `throttle.max_downloads.global`
- `throttle.max_downloads.global.set`
- `throttle.max_uploads.global`
- `throttle.max_uploads.global.set`
- `network.port_range`
- `network.port_range.set`
- `network.port_open`
- `network.bind_address`
- `network.proxy_address`
- `network.http.proxy_address`
- `network.scgi.open_local`
- `network.scgi.open_port`
- `network.xmlrpc.dialect.set`
- `network.xmlrpc.size_limit`
- `protocol.encryption.set`
- `protocol.pex`
- `dht.mode.set`
- `dht.port`

### Scripting and automation

Useful for advanced integrations and config management:

- `method.insert`
- `method.get`
- `method.set`
- `method.list_keys`
- `method.has_key`
- `method.set_key`
- `schedule2`
- `schedule_remove2`

## Useful multicall pattern

For efficient snapshots, use `d.multicall2` for torrent rows and `t.multicall` or `f.multicall` for nested resources, then normalize result arrays by column order on the client side.

Example:

```text
d.multicall2("", "main", "d.hash=", "d.name=", "d.size_bytes=", "d.custom=addtime")
```

Remember that selector order defines result column order.

## Electorrent usage

Electorrent uses:

- `system.client_version`
- `d.multicall2`
- `t.multicall`
- `system.multicall`
- `f.multicall`
- `load.start`
- `load.raw_start`
- `execute.throw`
- `d.open`, `d.start`
- `d.stop`, `d.close`
- `d.custom1.set`
- `d.custom=addtime`
- `d.custom5.set`
- `d.erase`
- `d.delete_tied`
- `d.check_hash`
- `d.priority.set`

## References

- https://github.com/rakshasa/rtorrent/wiki/rTorrent-0.9-Comprehensive-Command-list-%28WIP%29
- https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html
- https://raw.githubusercontent.com/rtorrent-community/rtorrent-docs/master/docs/cmd-ref.rst
