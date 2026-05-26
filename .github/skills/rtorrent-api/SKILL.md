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

## Critical calling convention

All `d.*` commands take the torrent info hash as the first argument when called through XML-RPC.

Example shape:

```text
d.name = <hash> -> string
```

This explicit target requirement also matters for tracker/file/peer commands that operate on a torrent object.

## Important command groups

| Group | Purpose |
|---|---|
| `d.*` | Torrent/download fields and actions |
| `t.*` | Tracker fields and tracker multicalls |
| `f.*` | File fields |
| `p.*` | Peer fields |
| `load.*` | Add torrents and magnet links |
| `session.*` | Session state |
| `method.*`, `event.*` | Scripting hooks |
| `execute.*`, `system.*` | Host/system interaction |
| `network.*`, `protocol.*`, `throttle.*` | Network and rate settings |

## Commands commonly used for remote clients

### Connection and capability

- `system.client_version`
- `system.api_version` if present on the target

### Torrent listing

- `d.multicall2("", "main", ...)`
  - query many torrent fields at once from the `main` view
- `system.multicall([...])`
  - batch heterogeneous XML-RPC calls

### Tracker listing

- `t.multicall(<hash>, "", ...)`
  - query trackers for one torrent

### Adding torrents

- `load.start("", <uri>)`
  - add from URL or magnet and start
- `load.raw_start("", <torrent-bytes>)`
  - add from raw torrent bytes and start

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

### Labels and priority

- `d.custom1.set(<hash>, <label>)`
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

## Useful multicall pattern

For efficient snapshots, use `d.multicall2` for torrent rows and `t.multicall` for trackers, then normalize result arrays by column order on the client side.

## Electorrent usage

Electorrent uses:

- `system.client_version`
- `d.multicall2`
- `t.multicall`
- `system.multicall`
- `load.start`
- `load.raw_start`
- `execute.throw`
- `d.open`, `d.start`
- `d.stop`, `d.close`
- `d.custom1.set`
- `d.erase`
- `d.delete_tied`
- `d.check_hash`
- `d.priority.set`

## Reference

- https://rtorrent-docs.readthedocs.io/en/latest/cmd-ref.html
- https://raw.githubusercontent.com/rtorrent-community/rtorrent-docs/master/docs/cmd-ref.rst
