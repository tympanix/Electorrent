---
name: rtorrent-api
description: >
  rTorrent XML-RPC command reference focused on remote control, multicall
  patterns, load methods, and the torrent commands used by Electorrent.
---

# rTorrent Complete Command Reference

All commands described using Python-style function signatures:

```python
# Global command (no target needed):
call("system.hostname") -> str

# Download-targeted command (first arg is download info hash):
call("d.name", target: str) -> str

# Download command with extra arguments:
call("d.priority.set", target: str, v: int) -> None
```

**Target types** (first RPC argument for each prefix):

| Prefix | Target type | Description |
|--------|-------------|-------------|
| `d.*`  | `target: str` | Download info hash (hex string). Required. |
| `p.*`  | (implicit) | Peer. Used inside `p.multicall`; target is implicit. |
| `f.*`  | (implicit) | File. Used inside `f.multicall`; target is implicit. |
| `t.*`  | (implicit) | Tracker. Used inside `t.multicall`; target is implicit. |
| `fi.*` | (implicit) | File list iterator. Internal use. |
| (none) | — | Global command, pass `""` as target or omit. |

**Return types:**

| Type | Description |
|------|-------------|
| `str` | String |
| `int` | 64-bit signed integer |
| `bool` | Boolean (returns `int` 0/1 in RPC) |
| `list[T]` | List of elements |
| `dict[K, V]` | Key-value map |
| `any` | Return type depends on context |
| `None` | Command returns nothing meaningful |

---

## Table of Contents

- [Download Commands (`d.*`)](#download-commands-d)
- [Peer Commands (`p.*`)](#peer-commands-p)
- [File Commands (`f.*`)](#file-commands-f)
- [Tracker Commands (`t.*`)](#tracker-commands-t)
- [Choke Group Commands (`choke_group.*`)](#choke-group-commands-choke_group)
- [Network Commands (`network.*`)](#network-commands-network)
- [Protocol Commands (`protocol.*`)](#protocol-commands-protocol)
- [System Commands (`system.*`)](#system-commands-system)
- [Pieces / Chunk Commands (`pieces.*`)](#pieces--chunk-commands-pieces)
- [Session Commands (`session.*`)](#session-commands-session)
- [Throttle Commands (`throttle.*`)](#throttle-commands-throttle)
- [View / UI Commands (`view.*`, `ui.*`)](#view--ui-commands-view-ui)
- [Event / Scheduling Commands](#event--scheduling-commands)
- [IP Filter Commands (`ip_tables.*`, `ipv4_filter.*`)](#ip-filter-commands)
- [Logging Commands (`log.*`)](#logging-commands-log)
- [Dynamic Method Commands (`method.*`)](#dynamic-method-commands-method)
- [Logic / Control Flow](#logic--control-flow)
- [Math Commands (`math.*`)](#math-commands-math)
- [Conversion Commands (`convert.*`)](#conversion-commands-convert)
- [Elapsed Time Commands](#elapsed-time-commands)
- [Color Commands (`color.*`)](#color-commands-color)
- [String Enumeration Commands (`strings.*`)](#string-enumeration-commands-strings)
- [Scheduler Commands (`scheduler.*`)](#scheduler-commands-scheduler)
- [File Output / Group Insert](#file-output--group-insert)
- [Lua Commands](#lua-commands)
- [Dynamic Ratio Groups](#dynamic-ratio-groups)

---

## Download Commands (`d.*`)

### Identification / Metadata

```python
call("d.hash", target: str) -> str                        # torrent info hash (hex)
call("d.local_id", target: str) -> str                    # local peer ID (hex)
call("d.local_id_html", target: str) -> str               # local peer ID (HTML escaped)
call("d.bitfield", target: str) -> str                    # completed pieces bitfield (hex)
call("d.base_path", target: str) -> str                   # base filesystem path
call("d.base_filename", target: str) -> str               # base filename
call("d.name", target: str) -> str                        # torrent name
call("d.creation_date", target: str) -> int               # torrent creation date (unix timestamp)
call("d.load_date", target: str) -> int                   # date loaded into client (unix timestamp)
```

### Transfer Stats

```python
call("d.up.rate", target: str) -> int                     # upload rate (bytes/s)
call("d.up.total", target: str) -> int                    # total uploaded (bytes)
call("d.down.rate", target: str) -> int                   # download rate (bytes/s)
call("d.down.total", target: str) -> int                  # total downloaded (bytes)
call("d.skip.rate", target: str) -> int                   # skipped data rate (bytes/s)
call("d.skip.total", target: str) -> int                  # total skipped data (bytes)
```

### PEX

```python
call("d.peer_exchange", target: str) -> bool              # whether PEX is enabled
call("d.peer_exchange.set", target: str, v: bool) -> None # enable/disable PEX
```

### State / Status

```python
call("d.is_open", target: str) -> bool                    # is download open
call("d.is_active", target: str) -> bool                  # is actively transferring
call("d.is_hash_checked", target: str) -> bool            # has hash been checked
call("d.is_hash_checking", target: str) -> bool           # is hash check in progress
call("d.is_multi_file", target: str) -> bool              # is multi-file torrent
call("d.is_private", target: str) -> bool                 # is private torrent
call("d.is_pex_active", target: str) -> bool              # is PEX active
call("d.is_partially_done", target: str) -> bool          # is partially downloaded
call("d.is_not_partially_done", target: str) -> bool      # is not partially downloaded
call("d.is_meta", target: str) -> bool                    # is magnet/metadata download
```

### Lifecycle Control

```python
call("d.resume", target: str) -> None                     # resume download
call("d.pause", target: str) -> None                      # pause download
call("d.open", target: str) -> None                       # open download (allocate files)
call("d.close", target: str) -> None                      # close download
call("d.close.directly", target: str) -> None             # close immediately (no cleanup)
call("d.erase", target: str) -> None                      # erase/remove download
call("d.check_hash", target: str) -> None                 # trigger hash check
call("d.save_resume", target: str) -> None                # save resume data
call("d.save_full_session", target: str) -> None          # save full session data
call("d.update_priorities", target: str) -> None          # update file priorities
```

### Composite Lifecycle (execute multiple steps)

```python
call("d.start", target: str) -> None                     # start: clear hashing_failed, set view=started
call("d.stop", target: str) -> None                      # stop: set view=stopped
call("d.try_start", target: str) -> None                 # start unless hashing_failed or ignore_commands
call("d.try_stop", target: str) -> None                  # stop unless ignore_commands
call("d.try_close", target: str) -> None                 # close unless ignore_commands
call("d.incomplete", target: str) -> bool                # inverse of d.complete
```

### Custom Fields

```python
call("d.custom", target: str, key: str) -> str                    # get custom value (empty if not found)
call("d.custom_throw", target: str, key: str) -> str              # get custom value (throws if not found)
call("d.custom.set", target: str, key: str, value: str) -> None   # set custom value
call("d.custom.if_z", target: str, key: str, default: str) -> str # get custom value or default if empty
call("d.custom.keys", target: str) -> list[str]                   # list all custom keys
call("d.custom.items", target: str) -> dict[str, str]             # all custom key-value pairs

# Shorthand custom string fields:
call("d.custom1", target: str) -> str
call("d.custom1.set", target: str, v: str) -> None
call("d.custom2", target: str) -> str
call("d.custom2.set", target: str, v: str) -> None
call("d.custom3", target: str) -> str
call("d.custom3.set", target: str, v: str) -> None
call("d.custom4", target: str) -> str
call("d.custom4.set", target: str, v: str) -> None
call("d.custom5", target: str) -> str
call("d.custom5.set", target: str, v: str) -> None
```

### State Variables

```python
# state: 0=stopped, 1=started
call("d.state", target: str) -> int
call("d.state.set", target: str, v: int) -> None

# complete: 0=not complete, 1=complete
call("d.complete", target: str) -> int
call("d.complete.set", target: str, v: int) -> None

# mode: 0=off, 1=scheduled, 2=forced on, 3=forced off
call("d.mode", target: str) -> int
call("d.mode.set", target: str, v: int) -> None

# hashing: 0=not hashing, 1=normal, 2=download finished hashing, 3=rehashing
call("d.hashing", target: str) -> int
call("d.hashing.set", target: str, v: int) -> None

# tied_to_file: file this download is associated with
call("d.tied_to_file", target: str) -> str
call("d.tied_to_file.set", target: str, v: str) -> None

# loaded_file: file this torrent was loaded from (setter is private/not in RPC)
call("d.loaded_file", target: str) -> str

# state_changed: unix timestamp of last state change
call("d.state_changed", target: str) -> int
call("d.state_changed.set", target: str, v: int) -> None

# state_counter: number of state changes
call("d.state_counter", target: str) -> int
call("d.state_counter.set", target: str, v: int) -> None

# ignore_commands: whether to ignore commands
call("d.ignore_commands", target: str) -> int
call("d.ignore_commands.set", target: str, v: int) -> None

# hashing_failed: whether hash check failed
call("d.hashing_failed", target: str) -> bool
call("d.hashing_failed.set", target: str, v: bool) -> None
```

### Timestamps

```python
# .set and .set_if_z are private (not available via RPC)
call("d.timestamp.started", target: str) -> int                  # start timestamp (unix)
call("d.timestamp.started.set", target: str, v: int) -> None     # set start timestamp (PRIVATE)
call("d.timestamp.started.set_if_z", target: str, v: int) -> None # set only if currently zero (PRIVATE)
call("d.timestamp.started.or_zero", target: str) -> int           # get timestamp or 0 if unset
call("d.timestamp.started.elapsed", target: str, v: int) -> bool  # true if (now - timestamp) > v

call("d.timestamp.finished", target: str) -> int                  # finish timestamp (unix)
call("d.timestamp.finished.set", target: str, v: int) -> None     # set finish timestamp (PRIVATE)
call("d.timestamp.finished.set_if_z", target: str, v: int) -> None # set only if currently zero (PRIVATE)
call("d.timestamp.finished.or_zero", target: str) -> int           # get timestamp or 0 if unset
call("d.timestamp.finished.elapsed", target: str, v: int) -> bool  # true if (now - timestamp) > v
```

### Connection / Choke Heuristics

```python
call("d.connection_current", target: str) -> str                         # current connection type
call("d.connection_current.set", target: str, type: str) -> None         # set connection type
call("d.connection_leech", target: str) -> str                           # connection when leeching (setter private)
call("d.connection_seed", target: str) -> str                            # connection when seeding (setter private)

call("d.up.choke_heuristics", target: str) -> str                        # current upload choke heuristics
call("d.up.choke_heuristics.set", target: str, heur: str) -> None        # set upload choke heuristics
call("d.down.choke_heuristics", target: str) -> str                      # current download choke heuristics
call("d.down.choke_heuristics.set", target: str, heur: str) -> None      # set download choke heuristics

call("d.up.choke_heuristics.leech", target: str) -> str                  # upload heuristics when leeching (setter private)
call("d.up.choke_heuristics.seed", target: str) -> str                   # upload heuristics when seeding (setter private)
call("d.down.choke_heuristics.leech", target: str) -> str                # download heuristics when leeching (setter private)
call("d.down.choke_heuristics.seed", target: str) -> str                 # download heuristics when seeding (setter private)
```

### Views

```python
call("d.views", target: str) -> list                                # list of views this download belongs to
call("d.views.has", target: str, view: str) -> int                  # is download in this view (0/1)
call("d.views.push_back", target: str, view: str) -> None           # add to view
call("d.views.push_back_unique", target: str, view: str) -> None    # add to view (no duplicates)
call("d.views.remove", target: str, view: str) -> None              # remove from view
```

### Peer Limits

```python
call("d.peers_min", target: str) -> int                            # min peers
call("d.peers_min.set", target: str, v: int) -> None               # set min peers
call("d.peers_max", target: str) -> int                            # max peers
call("d.peers_max.set", target: str, v: int) -> None               # set max peers
call("d.uploads_max", target: str) -> int                          # max upload slots
call("d.uploads_max.set", target: str, v: int) -> None             # set max upload slots
call("d.uploads_min", target: str) -> int                          # min upload slots
call("d.uploads_min.set", target: str, v: int) -> None             # set min upload slots
call("d.downloads_max", target: str) -> int                        # max download slots
call("d.downloads_max.set", target: str, v: int) -> None           # set max download slots
call("d.downloads_min", target: str) -> int                        # min download slots
call("d.downloads_min.set", target: str, v: int) -> None           # set min download slots

call("d.peers_connected", target: str) -> int                      # number of connected peers
call("d.peers_not_connected", target: str) -> int                  # number of not-connected peers
call("d.peers_complete", target: str) -> int                       # number of seed peers
call("d.peers_accounted", target: str) -> int                      # number of accounted peers
call("d.disconnect.seeders", target: str) -> None                  # disconnect all seeders
```

### Seeder Acceptance / Throttle

```python
call("d.accepting_seeders", target: str) -> bool                   # accepting seeders
call("d.accepting_seeders.enable", target: str) -> None            # enable accepting seeders
call("d.accepting_seeders.disable", target: str) -> None           # disable accepting seeders
call("d.throttle_name", target: str) -> str                        # assigned throttle name
call("d.throttle_name.set", target: str, name: str) -> None        # set throttle name
```

### Progress / Size

```python
call("d.bytes_done", target: str) -> int                           # bytes downloaded
call("d.ratio", target: str) -> int                                # share ratio (upload/download * 1000)
call("d.chunks_hashed", target: str) -> int                        # number of chunks hashed
call("d.free_diskspace", target: str) -> int                       # free disk space (bytes)
call("d.size_files", target: str) -> int                           # number of files
call("d.size_bytes", target: str) -> int                           # total size (bytes)
call("d.size_chunks", target: str) -> int                          # number of chunks
call("d.chunk_size", target: str) -> int                           # chunk size (bytes)
call("d.size_pex", target: str) -> int                             # number of PEX peers
call("d.max_size_pex", target: str) -> int                         # max PEX peers
call("d.chunks_seen", target: str) -> str                          # chunks seen across peers (hex)
call("d.completed_bytes", target: str) -> int                      # bytes completed
call("d.completed_chunks", target: str) -> int                     # chunks completed
call("d.left_bytes", target: str) -> int                           # bytes remaining
call("d.wanted_chunks", target: str) -> int                        # number of wanted chunks
```

### Trackers

```python
call("d.tracker_announce", target: str) -> None                    # trigger tracker announce
call("d.tracker_announce.force", target: str) -> None              # force announce (bypass interval)
call("d.tracker_numwant", target: str) -> int                      # numwant value
call("d.tracker_numwant.set", target: str, v: int) -> None         # set numwant
call("d.tracker_focus", target: str) -> int                        # focused tracker index (deprecated)
call("d.tracker_size", target: str) -> int                         # number of trackers

call("d.tracker.has_active", target: str) -> bool                  # any active tracker
call("d.tracker.has_active_not_scrape", target: str) -> bool       # any active non-scrape tracker
call("d.tracker.has_usable", target: str) -> bool                  # any usable tracker
call("d.tracker.insert", target: str, group: int, url: str) -> None # insert extra tracker
call("d.tracker.send_scrape", target: str, group: int) -> None     # send scrape request
```

### Directory / Priority / Group

```python
call("d.directory", target: str) -> str                            # download directory
call("d.directory.set", target: str, path: str) -> None            # set download directory
call("d.directory_base", target: str) -> str                       # download base directory
call("d.directory_base.set", target: str, path: str) -> None       # set base directory directly

call("d.priority", target: str) -> int                             # priority: 0=off, 1=low, 2=normal, 3=high
call("d.priority.set", target: str, v: int) -> None                # set priority
call("d.priority_str", target: str) -> str                         # priority as string

call("d.group", target: str) -> int                                # choke group index
call("d.group.name", target: str) -> str                           # choke group name
call("d.group.set", target: str, group: int | str) -> None         # set choke group (by index or name)

call("d.message", target: str) -> str                              # download message
call("d.message.set", target: str, msg: str) -> None               # set download message
call("d.max_file_size", target: str) -> int                        # max file size
call("d.max_file_size.set", target: str, v: int) -> None           # set max file size
```

### Symlinks / Tied Files

```python
# type: "base_path", "base_filename", or "tied"
call("d.create_link", target: str, type: str, prefix: str, postfix: str) -> None  # create symlink
call("d.delete_link", target: str, type: str, prefix: str, postfix: str) -> None  # delete symlink
call("d.delete_tied", target: str) -> None                                        # delete tied file
```

### Multicall / Peer Targeting

```python
# Iterate over files of a download. filter: regex pattern or "" for all files.
call("f.multicall", target: str, filter: str, *cmds: str) -> list[list[any]]

# Iterate over peers of a download.
call("p.multicall", target: str, *cmds: str) -> list[list[any]]

# Iterate over trackers of a download.
call("t.multicall", target: str, *cmds: str) -> list[list[any]]

# Call a command on a specific peer identified by download hash and peer ID (hex).
call("p.call_target", dl_hash: str, peer_id: str, cmd: str, *args: any) -> any

# Add a peer to a download.
call("add_peer", target: str, hostport: str) -> None
```

---

## Peer Commands (`p.*`)

Used inside `p.multicall`. No explicit target argument — the target (peer) is implicit.

```python
call("p.id") -> str                          # peer ID (hex)
call("p.id_html") -> str                     # peer ID (HTML escaped)
call("p.client_version") -> str              # client version string
call("p.options_str") -> str                 # options bitmask (hex)

call("p.is_encrypted") -> bool               # connection encrypted
call("p.is_incoming") -> bool                # incoming connection
call("p.is_obfuscated") -> bool              # connection obfuscated
call("p.is_snubbed") -> bool                 # peer is snubbed
call("p.is_unwanted") -> bool                # peer is unwanted
call("p.is_preferred") -> bool               # peer is preferred

call("p.address") -> str                     # IP address (IPv6 in brackets)
call("p.port") -> int                        # port number
call("p.completed_percent") -> int           # completion percentage

call("p.up_rate") -> int                     # upload rate to peer (bytes/s)
call("p.up_total") -> int                    # total uploaded to peer (bytes)
call("p.down_rate") -> int                   # download rate from peer (bytes/s)
call("p.down_total") -> int                  # total downloaded from peer (bytes)
call("p.peer_rate") -> int                   # peer's reported rate (bytes/s)
call("p.peer_total") -> int                  # peer's reported total (bytes)

call("p.snubbed") -> bool                    # is snubbed
call("p.snubbed.set", v: bool) -> None       # set snubbed state
call("p.banned") -> bool                     # is banned
call("p.banned.set", v: bool) -> None        # set banned state

call("p.disconnect") -> None                 # disconnect peer
call("p.disconnect_delayed") -> None         # disconnect peer (delayed)
```

---

## File Commands (`f.*`)

Used inside `f.multicall`. No explicit target argument — the target (file) is implicit.

```python
call("f.is_created") -> bool                 # file exists on disk
call("f.is_open") -> bool                    # file is open

call("f.is_create_queued") -> bool           # creation is queued
call("f.is_resize_queued") -> bool           # resize is queued
call("f.set_create_queued") -> None          # mark for creation
call("f.set_resize_queued") -> None          # mark for resize
call("f.unset_create_queued") -> None        # unmark creation
call("f.unset_resize_queued") -> None        # unmark resize

call("f.prioritize_first") -> bool           # prioritize-first flag
call("f.prioritize_first.enable") -> None    # enable prioritize-first
call("f.prioritize_first.disable") -> None   # disable prioritize-first
call("f.prioritize_last") -> bool            # prioritize-last flag
call("f.prioritize_last.enable") -> None     # enable prioritize-last
call("f.prioritize_last.disable") -> None    # disable prioritize-last

call("f.size_bytes") -> int                  # file size (bytes)
call("f.size_chunks") -> int                 # number of chunks
call("f.completed_chunks") -> int            # completed chunks
call("f.offset") -> int                      # byte offset in torrent
call("f.range_first") -> int                 # first chunk index
call("f.range_second") -> int                # last chunk index + 1

call("f.priority") -> int                    # file priority
call("f.priority.set", v: int) -> None       # set file priority
call("f.path") -> str                        # full file path
call("f.path_components") -> list[str]       # path split into components
call("f.path_depth") -> int                  # number of path components
call("f.frozen_path") -> str                 # frozen path string
call("f.match_depth_prev") -> int            # match depth with previous file
call("f.match_depth_next") -> int            # match depth with next file
call("f.last_touched") -> int                # last touched timestamp
```

### File Iterator (`fi.*`)

Internal use for file list iteration.

```python
call("fi.filename_last") -> str              # filename at current depth level
call("fi.is_file") -> bool                   # is a file (not directory)
```

---

## Tracker Commands (`t.*`)

Used inside `t.multicall`. No explicit target argument — the target (tracker) is implicit.

```python
call("t.is_busy") -> bool                    # tracker is busy
call("t.is_enabled") -> bool                 # tracker is enabled
call("t.is_extra_tracker") -> bool           # is an extra (user-added) tracker
call("t.is_open") -> bool                    # tracker is open/busy
call("t.is_scrapable") -> bool               # supports scrape
call("t.is_usable") -> bool                  # is usable
call("t.can_scrape") -> bool                 # deprecated: same as t.is_scrapable

call("t.enable") -> None                     # enable tracker
call("t.disable") -> None                    # disable tracker
call("t.is_enabled.set", v: bool) -> None    # set enabled state

call("t.url") -> str                         # announce URL
call("t.group") -> int                       # tracker group number
call("t.type") -> int                        # tracker type
call("t.id") -> str                          # tracker ID

call("t.latest_event") -> int                # latest event type
call("t.latest_new_peers") -> int            # new peers from latest event
call("t.latest_sum_peers") -> int            # total peers from latest event
call("t.normal_interval") -> int             # normal announce interval (seconds)
call("t.min_interval") -> int                # minimum announce interval (seconds)

call("t.activity_time_next") -> int          # next activity time
call("t.activity_time_last") -> int          # last activity time
call("t.success_time_next") -> int           # next success time
call("t.success_time_last") -> int           # last success time
call("t.success_counter") -> int             # success counter
call("t.failed_time_next") -> int            # next failure time
call("t.failed_time_last") -> int            # last failure time
call("t.failed_counter") -> int              # failure counter

call("t.scrape_time_last") -> int            # last scrape time
call("t.scrape_counter") -> int              # scrape counter
call("t.scrape_complete") -> int             # complete peers from scrape
call("t.scrape_incomplete") -> int           # incomplete peers from scrape
call("t.scrape_downloaded") -> int           # downloaded count from scrape
```

### Global Tracker / DHT Commands

```python
call("trackers.enable", target: str = "") -> None                 # enable all trackers
call("trackers.disable", target: str = "") -> None                # disable all trackers
call("trackers.delay_scrape") -> bool                             # delay scrape (get/set)
call("trackers.numwant") -> int                                   # default numwant value (get/set)
call("trackers.use_udp") -> bool                                  # use UDP trackers (get/set)

call("dht.mode.set", mode: str) -> None                           # set DHT mode ("none", "passive", "active")
call("dht.port") -> int                                           # DHT port
call("dht.override_port") -> int                                  # DHT override port
call("dht.override_port.set", port: int) -> None                   # set DHT override port
call("dht.add_node", hostport: str) -> None                        # add DHT bootstrap node ("host:port")
call("dht.statistics") -> any                                      # DHT statistics
```

---

## Choke Group Commands (`choke_group.*`)

```python
call("choke_group.list") -> list[str]                               # list all group names
call("choke_group.insert", name: str) -> None                       # create new choke group
call("choke_group.size") -> int                                     # number of groups
call("choke_group.index_of", name: str) -> int                      # group index by name

call("choke_group.general.size", group: int | str) -> int           # number of torrents in group
call("choke_group.tracker.mode", group: int | str) -> str           # tracker mode of group
call("choke_group.tracker.mode.set", group: int | str, mode: str) -> None  # set tracker mode

call("choke_group.all.up.update_balance") -> None                   # update all upload groups
call("choke_group.all.down.update_balance") -> None                 # update all download groups

call("choke_group.up.rate", group: int | str) -> int                # group upload rate (bytes/s)
call("choke_group.down.rate", group: int | str) -> int              # group download rate (bytes/s)

call("choke_group.up.max", group: int | str) -> int                 # max upload slots for group
call("choke_group.up.max.unlimited", group: int | str) -> bool      # is upload unlimited
call("choke_group.up.max.set", group: int | str, max: int) -> None  # set max upload slots
call("choke_group.up.total", group: int | str) -> int               # total upload connections
call("choke_group.up.queued", group: int | str) -> int              # queued upload connections
call("choke_group.up.unchoked", group: int | str) -> int            # unchoked uploads
call("choke_group.up.heuristics", group: int | str) -> str          # upload heuristics name
call("choke_group.up.heuristics.set", group: int | str, h: str) -> None

call("choke_group.down.max", group: int | str) -> int               # max download slots
call("choke_group.down.max.unlimited", group: int | str) -> bool    # is download unlimited
call("choke_group.down.max.set", group: int | str, max: int) -> None
call("choke_group.down.total", group: int | str) -> int             # total download connections
call("choke_group.down.queued", group: int | str) -> int            # queued download connections
call("choke_group.down.unchoked", group: int | str) -> int          # unchoked downloads
call("choke_group.down.heuristics", group: int | str) -> str        # download heuristics name
call("choke_group.down.heuristics.set", group: int | str, h: str) -> None
```

---

## Network Commands (`network.*`)

### Port / Listen

```python
call("network.port_open") -> bool                                # open listening port (get/set)
call("network.port_random") -> bool                              # use random port (get/set)
call("network.port_range") -> str                                # port range string (get/set)
call("network.listen.port") -> int                               # actual listening port
call("network.listen.backlog") -> int                            # TCP listen backlog
call("network.listen.backlog.set", v: int) -> None               # set listen backlog
```

### HTTP Stack

```python
call("network.http.cacert") -> str                               # CA certificate file path
call("network.http.cacert.set", path: str) -> None               # set CA certificate file
call("network.http.capath") -> str                               # CA certificate directory
call("network.http.capath.set", path: str) -> None               # set CA certificate directory
call("network.http.dns_cache_timeout") -> int                    # DNS cache timeout (seconds)
call("network.http.dns_cache_timeout.set", v: int) -> None       # set DNS cache timeout
call("network.http.current_open") -> int                         # open HTTP connections
call("network.http.max_cache_connections") -> int                # max cached HTTP connections
call("network.http.max_cache_connections.set", v: int) -> None   # set max cached connections
call("network.http.max_host_connections") -> int                 # max connections per host
call("network.http.max_host_connections.set", v: int) -> None    # set max per-host connections
call("network.http.max_total_connections") -> int                # max total HTTP connections
call("network.http.max_total_connections.set", v: int) -> None   # set max total connections
call("network.http.proxy_address") -> str                        # HTTP proxy address
call("network.http.proxy_address.set", addr: str) -> None        # set HTTP proxy
call("network.http.ssl_verify_host") -> int                      # verify SSL hostname
call("network.http.ssl_verify_host.set", v: int) -> None         # set SSL host verification
call("network.http.ssl_verify_peer") -> int                      # verify SSL peer cert
call("network.http.ssl_verify_peer.set", v: int) -> None         # set SSL peer verification
```

### Buffers / TOS

```python
call("network.send_buffer.size") -> int                          # TCP send buffer size
call("network.send_buffer.size.set", v: int) -> None             # set send buffer size
call("network.receive_buffer.size") -> int                       # TCP receive buffer size
call("network.receive_buffer.size.set", v: int) -> None          # set receive buffer size
call("network.tos.set", tos: str) -> None                        # set IP Type of Service
```

### Bind / Local Address

```python
call("network.bind_address") -> str                              # best-match bind address
call("network.bind_address.set", addr: str) -> None              # set bind address
call("network.bind_address.ipv4") -> str                         # IPv4 bind address
call("network.bind_address.ipv4.set", addr: str) -> None         # set IPv4 bind address
call("network.bind_address.ipv6") -> str                         # IPv6 bind address
call("network.bind_address.ipv6.set", addr: str) -> None         # set IPv6 bind address

call("network.local_address") -> str                             # best-match local address
call("network.local_address.set", addr: str) -> None             # set local address
call("network.local_address.ipv4") -> str                        # IPv4 local address
call("network.local_address.ipv4.set", addr: str) -> None        # set IPv4 local address
call("network.local_address.ipv6") -> str                        # IPv6 local address
call("network.local_address.ipv6.set", addr: str) -> None        # set IPv6 local address

call("network.proxy_address") -> str                             # SOCKS proxy address
call("network.proxy_address.set", addr: str) -> None             # set SOCKS proxy
```

### File / Socket Limits

```python
call("network.open_files") -> int                                # number of open files
call("network.max_open_files") -> int                            # max open files
call("network.max_open_files.set", v: int) -> None               # set max open files
call("network.total_handshakes") -> int                          # total handshakes
call("network.open_sockets") -> int                              # open sockets
call("network.max_open_sockets") -> int                          # max open sockets
call("network.max_open_sockets.set", v: int) -> None             # set max open sockets
```

### SCGI / RPC

```python
call("network.scgi.open_port", addr: str) -> None                # open SCGI on TCP ("host:port" or ":port")
call("network.scgi.open_local", path: str) -> None               # open SCGI on Unix socket
call("network.scgi.dont_route") -> bool                          # don't route SCGI (get/set)
call("network.scgi.open_systemd") -> None                        # SCGI via systemd socket activation
call("network.scgi.use_gzip") -> bool                            # SCGI gzip compression
call("network.scgi.use_gzip.set", v: bool) -> None               # set SCGI gzip
call("network.scgi.gzip.min_size") -> int                        # min size for gzip
call("network.scgi.gzip.min_size.set", v: int) -> None           # set gzip min size

call("network.xmlrpc.dialect.set", dialect: str) -> None          # set XMLRPC dialect ("i8", "apache", "generic")
call("network.xmlrpc.size_limit") -> int                         # max XMLRPC request size
call("network.xmlrpc.size_limit.set", v: int) -> None            # set XMLRPC size limit

call("network.rpc.use_xmlrpc") -> bool                           # enable XMLRPC (get/set)
call("network.rpc.use_jsonrpc") -> bool                          # enable JSONRPC (get/set)
```

### IP Blocking

```python
call("network.block.ipv4") -> bool                               # block IPv4 (get/set)
call("network.block.ipv4.set", v: bool) -> None
call("network.block.ipv6") -> bool                               # block IPv6 (get/set)
call("network.block.ipv6.set", v: bool) -> None
call("network.block.ipv4in6") -> bool                            # block IPv4-in-IPv6 (get/set)
call("network.block.ipv4in6.set", v: bool) -> None
call("network.block.outgoing") -> bool                           # block outgoing (get/set)
call("network.block.outgoing.set", v: bool) -> None
call("network.prefer.ipv6") -> bool                              # prefer IPv6 (get/set)
call("network.prefer.ipv6.set", v: bool) -> None
```

---

## Protocol Commands (`protocol.*`)

```python
call("protocol.pex") -> bool                                     # enable PEX (get/set)
call("protocol.encryption.set", *options: str) -> None            # set encryption options
call("protocol.connection.leech") -> str                         # default connection type for leeching (get/set)
call("protocol.connection.seed") -> str                          # default connection type for seeding (get/set)
call("protocol.choke_heuristics.up.leech") -> str                # upload heuristics when leeching (get/set)
call("protocol.choke_heuristics.up.seed") -> str                 # upload heuristics when seeding (get/set)
call("protocol.choke_heuristics.down.leech") -> str              # download heuristics when leeching (get/set)
call("protocol.choke_heuristics.down.seed") -> str               # download heuristics when seeding (get/set)

call("encoding.add", encoding: str) -> None                      # add character encoding
```

---

## System Commands (`system.*`)

### System Info

```python
call("system.hostname") -> str                                   # system hostname
call("system.pid") -> int                                        # process ID
call("system.api_version") -> str                                # rTorrent API version (read-only)
call("system.client_version") -> str                             # rTorrent version string (read-only)
call("system.library_version") -> str                            # libtorrent version string (read-only)
call("system.env", name: str) -> str                             # environment variable value
call("system.time") -> int                                       # current cached time (unix seconds)
call("system.time_seconds") -> int                               # current epoch seconds
call("system.time_usec") -> int                                  # current epoch microseconds
call("system.cwd") -> str                                        # current working directory
call("system.cwd.set", path: str) -> None                        # change working directory
call("system.umask.set", mask: int) -> None                      # set file creation mask
call("system.daemon") -> bool                                    # running as daemon (get/set)
```

### Shutdown

```python
call("system.shutdown.normal") -> None                           # normal shutdown (save session)
call("system.shutdown.quick") -> None                            # quick shutdown (no session save)
call("system.shutdown") -> None                                  # alias for system.shutdown.normal
```

### File System

```python
call("system.file.allocate") -> int                              # file allocation: 0=sparse, 1=preallocate (get/set)
call("system.file.max_size") -> int                              # max file size (read-only)
call("system.file.split_size") -> int                            # file split size, -1=disabled (read-only)
call("system.file.split_suffix") -> str                          # split file suffix (read-only)

call("system.file_status_cache.size") -> int                     # entries in file status cache
call("system.file_status_cache.prune") -> None                   # prune file status cache

call("system.files.advise_random") -> bool                       # use POSIX_FADV_RANDOM (get/set)
call("system.files.advise_random.set", v: bool) -> None
call("system.files.advise_random.hashing") -> bool               # FADV_RANDOM during hashing (get/set)
call("system.files.advise_random.hashing.set", v: bool) -> None
call("system.files.session.fdatasync") -> bool                   # fdatasync for session (get/set)
call("system.files.session.fdatasync.set", v: bool) -> None

call("system.files.opened_counter") -> int                       # files opened counter
call("system.files.closed_counter") -> int                       # files closed counter
call("system.files.failed_counter") -> int                       # file operation failures
```

### Prioritize Table of Contents

```python
call("file.prioritize_toc") -> bool                              # enable TOC-based prioritization (get/set)
call("file.prioritize_toc.first") -> list                        # files to prioritize first (get/set/push_back)
call("file.prioritize_toc.last") -> list                         # files to prioritize last (get/set/push_back)
```

---

## Pieces / Chunk Commands (`pieces.*`)

```python
call("pieces.sync.always_safe") -> bool                          # always use safe sync (get/set)
call("pieces.sync.always_safe.set", v: bool) -> None
call("pieces.sync.safe_free_diskspace") -> int                   # safe free disk space
call("pieces.sync.timeout") -> int                               # sync timeout (get/set)
call("pieces.sync.timeout.set", v: int) -> None
call("pieces.sync.timeout_safe") -> int                          # safe sync timeout (get/set)
call("pieces.sync.timeout_safe.set", v: int) -> None
call("pieces.sync.queue_size") -> int                            # sync queue size

call("pieces.preload.type") -> int                               # preload: 0=none, 1=sequential, 2=random (get/set)
call("pieces.preload.type.set", v: int) -> None
call("pieces.preload.min_size") -> int                           # min preload size (get/set)
call("pieces.preload.min_size.set", v: int) -> None
call("pieces.preload.min_rate") -> int                           # min rate for preloading (get/set)
call("pieces.preload.min_rate.set", v: int) -> None

call("pieces.memory.current") -> int                             # current chunk memory usage
call("pieces.memory.sync_queue") -> int                          # sync queue memory usage
call("pieces.memory.block_count") -> int                         # memory block count
call("pieces.memory.max") -> int                                 # max memory usage (get/set)
call("pieces.memory.max.set", v: int) -> None
call("pieces.stats_preloaded") -> int                            # preloaded pieces count
call("pieces.stats_not_preloaded") -> int                        # not-preloaded pieces count
call("pieces.stats.total_size") -> int                           # total size of all active downloads

call("pieces.hash.queue_size") -> int                            # hash queue size
call("pieces.hash.on_completion") -> bool                        # hash on completion (get/set)
```

---

## Session Commands (`session.*`)

```python
call("session.name") -> str                                      # session name (get/set)
call("session.path") -> str                                      # session path directory (get/set)
call("session.path.set", path: str) -> None
call("session.use_lock") -> bool                                 # use session lock file (get/set)
call("session.use_lock.set", v: bool) -> None
call("session.on_completion") -> bool                            # save session on completion (get/set)
call("session.save") -> None                                     # save session now

call("directory.default") -> str                                 # default download directory (get/set)
call("directory.default.set", path: str) -> None

call("magnet.path") -> str                                       # magnet file path (get/set)
call("magnet.path.set", path: str) -> None
```

---

## Throttle Commands (`throttle.*`)

### Global Unchoke Counts

```python
call("throttle.unchoked_uploads") -> int                          # current unchoked uploads
call("throttle.max_unchoked_uploads") -> int                      # max unchoked uploads
call("throttle.unchoked_downloads") -> int                        # current unchoked downloads
call("throttle.max_unchoked_downloads") -> int                    # max unchoked downloads
```

### Peer Limits

```python
call("throttle.min_peers.normal") -> int                          # min peers for normal (get/set)
call("throttle.min_peers.normal.set", v: int) -> None
call("throttle.max_peers.normal") -> int                          # max peers for normal (get/set)
call("throttle.max_peers.normal.set", v: int) -> None
call("throttle.min_peers.seed") -> int                            # min peers when seeding (get/set)
call("throttle.min_peers.seed.set", v: int) -> None
call("throttle.max_peers.seed") -> int                            # max peers when seeding (get/set)
call("throttle.max_peers.seed.set", v: int) -> None
```

### Upload/Download Slot Limits

```python
call("throttle.min_uploads") -> int                               # min upload slots (get/set)
call("throttle.min_uploads.set", v: int) -> None
call("throttle.max_uploads") -> int                               # max upload slots (get/set)
call("throttle.max_uploads.set", v: int) -> None
call("throttle.min_downloads") -> int                             # min download slots (get/set)
call("throttle.min_downloads.set", v: int) -> None
call("throttle.max_downloads") -> int                             # max download slots (get/set)
call("throttle.max_downloads.set", v: int) -> None

# Throttle division factors (redirects to ._val internal):
call("throttle.max_uploads.div") -> int                           # upload divisor (get/set)
call("throttle.max_uploads.div.set", v: int) -> None
call("throttle.max_uploads.global") -> int                        # upload global (get/set)
call("throttle.max_uploads.global.set", v: int) -> None
call("throttle.max_downloads.div") -> int                         # download divisor (get/set)
call("throttle.max_downloads.div.set", v: int) -> None
call("throttle.max_downloads.global") -> int                      # download global (get/set)
call("throttle.max_downloads.global.set", v: int) -> None
```

### Global Speed

```python
call("throttle.global_up.rate") -> int                            # global upload rate (bytes/s)
call("throttle.global_up.total") -> int                           # global upload total
call("throttle.global_up.max_rate") -> int                        # global upload max rate (bytes/s)
call("throttle.global_up.max_rate.set", v: int) -> None           # set global upload max rate (bytes/s)
call("throttle.global_up.max_rate.set_kb", v: int) -> None        # set global upload max rate (KB/s)

call("throttle.global_down.rate") -> int                          # global download rate (bytes/s)
call("throttle.global_down.total") -> int                         # global download total
call("throttle.global_down.max_rate") -> int                      # global download max rate (bytes/s)
call("throttle.global_down.max_rate.set", v: int) -> None         # set global download max rate (bytes/s)
call("throttle.global_down.max_rate.set_kb", v: int) -> None      # set global download max rate (KB/s)
```

### Named Throttles

```python
call("throttle.up", name: str, rate_kb: int) -> None              # create/set named upload throttle (KB/s)
call("throttle.down", name: str, rate_kb: int) -> None            # create/set named download throttle (KB/s)
call("throttle.ip", name: str, addr: str, end: str = "") -> None  # bind IP range to throttle

call("throttle.up.max", name: str = "") -> int                    # upload max rate for named throttle ("" = global)
call("throttle.up.rate", name: str = "") -> int                   # upload current rate for named throttle
call("throttle.down.max", name: str = "") -> int                  # download max rate for named throttle
call("throttle.down.rate", name: str = "") -> int                 # download current rate for named throttle
```

---

## View / UI Commands

### View Management (`view.*`)

```python
call("view.add", name: str) -> None                              # create a new view
call("view.list") -> list[str]                                   # list all view names
call("view.set", target: str, view: str) -> None                 # set view (not fully implemented)

call("view.filter", name: str, *filter_cmds: str) -> None        # set view filter
call("view.filter_on", name: str, *args: str) -> None            # set filter with arguments
call("view.filter.temp", name: str, *filter_cmds: str) -> None   # set temporary filter
call("view.filter.temp.excluded") -> str                         # views excluded from temp filter (get/set)
call("view.filter.temp.log") -> bool                             # log temp filter changes (get/set)

call("view.sort", name: str, value: int = 0) -> None             # sort view
call("view.sort_new", name: str, *sort_cmds: str) -> None        # set new-item sort
call("view.sort_current", name: str, *sort_cmds: str) -> None    # set current sort

call("view.event_added", name: str, event: str) -> None          # handler when item added to view
call("view.event_removed", name: str, event: str) -> None        # handler when item removed from view

call("view.size", name: str) -> int                              # visible items in view
call("view.size_not_visible", name: str) -> int                  # non-visible items in view
call("view.persistent", name: str) -> None                       # make view persistent

call("view.filter_all", name: str) -> None                       # re-filter all items in view
call("view.filter_download", target: str, name: str) -> None     # filter download in view
call("view.set_visible", target: str, view: str) -> None         # make download visible in view
call("view.set_not_visible", target: str, view: str) -> None     # make download not visible in view
```

### UI Control (`ui.*`)

```python
call("keys.layout") -> str                                       # keyboard layout (get/set)

call("ui.unfocus_download", target: str) -> None                 # unfocus a download
call("ui.current_view") -> str                                   # current view name
call("ui.current_view.set", name: str) -> None                   # switch to view
call("ui.input.history.size") -> int                             # input history size (get/set)
call("ui.input.history.size.set", v: int) -> None
call("ui.input.history.clear") -> None                           # clear input history

call("ui.throttle.global.step.small") -> int                     # small throttle step (get/set)
call("ui.throttle.global.step.medium") -> int                    # medium throttle step (get/set)
call("ui.throttle.global.step.large") -> int                     # large throttle step (get/set)
call("ui.focus.page_size") -> int                                # page size for scrolling (get/set)
call("ui.status.throttle.up.set", *names: str) -> None           # set up throttle display names
call("ui.status.throttle.down.set", *names: str) -> None         # set down throttle display names
call("ui.keymap.style") -> str                                   # keymap style (get/set)
call("ui.keymap.style.set", style: str) -> None
call("ui.torrent_list.layout") -> str                            # torrent list layout (get/set)
```

---

## Event / Scheduling Commands

### Tied File Events

```python
call("start_tied") -> None          # start downloads whose tied-to file exists
call("stop_untied") -> None         # stop downloads whose tied-to file is missing
call("close_untied") -> None        # close downloads whose tied-to file is missing
call("remove_untied") -> None       # remove downloads whose tied-to file is missing
```

### Scheduling

```python
call("schedule", name: str, time: str, interval: str, command: str) -> None
call("schedule2", name: str, time: str, interval: str, command: str) -> None
call("schedule.remove", name: str) -> None
call("schedule_remove2", name: str) -> None
```

### Import / Load

```python
call("import", path: str) -> None                                # import command file (throws on error)
call("try_import", path: str) -> None                            # try import (no throw on error)

call("load.normal", filename: str, *cmds: str) -> None           # load (quiet, tied)
call("load.verbose", filename: str, *cmds: str) -> None          # load (verbose, tied)
call("load.start", filename: str, *cmds: str) -> None            # load + start (quiet, tied)
call("load.start_verbose", filename: str, *cmds: str) -> None    # load + start (verbose, tied)
call("load.raw", data: str, *cmds: str) -> None                  # load raw torrent data (quiet)
call("load.raw_verbose", data: str, *cmds: str) -> None          # load raw torrent data (verbose)
call("load.raw_start", data: str, *cmds: str) -> None            # load raw + start (quiet)
call("load.raw_start_verbose", data: str, *cmds: str) -> None    # load raw + start (verbose)
```

### Ratio Events

```python
call("on_ratio", group_name: str) -> None                        # evaluate ratio for a group
```

### Disk Space

```python
call("close_low_diskspace", threshold: int) -> None              # close downloads below disk space threshold
call("close_low_diskspace.normal", threshold: int) -> None       # same, skip priority >= 3
```

### Download List / Multicall

```python
# view: view name, "" = "default"
call("download_list", view: str = "default") -> list[str]

# Iterate all downloads in a view. view: "" = "default"
call("d.multicall2", view: str = "default", *cmds: str) -> list[list[any]]

# Filtered multicall. view: "" = "default"
call("d.multicall.filtered", view: str = "default", filter_expr: str, *cmds: str) -> list[list[any]]

# Watch a directory for new .torrent files.
call("directory.watch.added", path: str, command: str) -> None
```

---

## IP Filter Commands

### Named IP Tables

```python
call("ip_tables.insert_table", name: str) -> None                # create a new IP table
call("ip_tables.size_data", name: str) -> int                    # table data size (bytes)
call("ip_tables.get", table: str, address: str) -> int            # get value for IP range in table
call("ip_tables.add_address", table: str, address: str, value: str) -> None  # add IP to table (value: "block")
```

### Global IPv4 Filter

```python
call("ipv4_filter.size_data") -> int                             # filter data size (bytes)
call("ipv4_filter.get", address: str) -> int                     # get filter value for IP/range
call("ipv4_filter.add_address", address: str, value: str) -> None # add IP to filter (value: "block")
call("ipv4_filter.load", filename: str, value: str) -> None      # load filter from p2p-format file
call("ipv4_filter.dump") -> list[str]                            # dump all filter rules
```

---

## Logging Commands (`log.*`)

```python
# Open log files (args: [name, path, *groups])
call("log.open_file", name: str, path: str, *groups: str) -> None
call("log.open_file.flush", name: str, path: str, *groups: str) -> None      # flush after each write
call("log.open_gz_file", name: str, path: str, *groups: str) -> None         # gzip compressed
call("log.open_file_pid", name: str, path: str, *groups: str) -> None        # append PID to path
call("log.open_gz_file_pid", name: str, path: str, *groups: str) -> None     # gzip + PID
call("log.append_file", name: str, path: str, *groups: str) -> None          # append mode
call("log.append_file.flush", name: str, path: str, *groups: str) -> None    # append + flush
call("log.append_gz_file", name: str, path: str, *groups: str) -> None       # append + gzip

call("log.close", name: str) -> None                             # close a log output
call("log.add_output", group: str, output: str) -> None          # route log group to output
call("log.execute", path: str) -> None                           # execute command log (deprecated)
call("log.vmmap.dump", path: str) -> None                        # dump VM mappings to file
call("log.rpc", name: str) -> None                               # set RPC log output
call("log.xmlrpc", name: str) -> None                            # deprecated: alias for log.rpc
```

---

## Dynamic Method Commands (`method.*`)

```python
call("system.listMethods") -> list[str]                               # list all commands (XMLRPC only)

call("method.use_deprecated") -> bool                                 # allow deprecated methods (get/set)
call("method.use_intermediate") -> int                                # compatibility level (get/set)

call("method.insert", name: str, flags: str, *body: str) -> None      # insert user-defined method
call("method.insert.value", name: str, *body: any) -> None            # insert value-type method
call("method.insert.bool", name: str, *body: any) -> None             # insert bool-type method
call("method.insert.string", name: str, *body: any) -> None           # insert string-type method
call("method.insert.list", name: str, *body: any) -> None             # insert list-type method
call("method.insert.simple", name: str, *body: str) -> None           # insert simple function
call("method.insert.c_simple", name: str, *body: str) -> None         # insert constant function
call("method.insert.s_c_simple", name: str, *body: str) -> None       # insert static constant function

call("method.erase", name: str) -> None                               # erase a user-defined method
call("method.redirect", new_name: str, existing: str) -> None          # create alias
call("method.get", name: str) -> any                                  # get method value
call("method.set", name: str, *body: str) -> None                     # set method body

call("method.const", name: str) -> bool                               # is method constant
call("method.const.enable", name: str) -> None                        # make method constant

call("method.has_key", name: str, key: str) -> bool                   # multi-type: has key
call("method.set_key", name: str, key: str, *value: any) -> None      # multi-type: set/delete key
call("method.list_keys", name: str) -> list[str]                      # multi-type: list keys

call("method.rlookup", value: str) -> list                            # reverse lookup methods by value
call("method.rlookup.clear", name: str) -> None                       # clear rlookup data
```

---

## Logic / Control Flow

```python
call("print", *args: any) -> None                                # print to log
call("cat", *args: any) -> str                                   # concatenate as string
call("value", v: str | int, base: int = 10) -> int               # parse integer value
call("try", cmd: any) -> any                                     # execute, catch errors
call("catch", cmd: any) -> any                                   # execute, catch input errors

call("if", cond: any, then: any, *elif_else: any) -> any         # if/else-if/else chain
call("branch", cond: any, then: any, *elif_else: any) -> any     # if with auto-eval (commands as literals)
call("not", v: any) -> bool                                      # boolean NOT
call("false") -> bool                                            # always false
call("and", *args: any) -> bool                                  # boolean AND (short-circuit)
call("or", *args: any) -> bool                                   # boolean OR (short-circuit)
```

### Comparisons

```python
call("less", a: any, b: any) -> bool                             # a < b
call("greater", a: any, b: any) -> bool                          # a > b
call("equal", a: any, b: any) -> bool                            # a == b
call("compare", order: str, *fields: str) -> int                 # multi-field comparison for sorting (target pair)
call("match", text: str, pattern: str) -> bool                   # regex match (case-insensitive)
```

---

## Math Commands (`math.*`)

```python
call("math.add", *args: int | str | list) -> int                 # sum
call("math.sub", *args: int | str | list) -> int                 # subtract
call("math.mul", *args: int | str | list) -> int                 # multiply
call("math.div", *args: int | str | list) -> int                 # divide (integer)
call("math.mod", *args: int | str | list) -> int                 # modulus
call("math.min", *args: int | str | list) -> int                 # minimum
call("math.max", *args: int | str | list) -> int                 # maximum
call("math.cnt", *args: int | str | list) -> int                 # count elements
call("math.avg", *args: int | str | list) -> int                 # average
call("math.med", *args: int | str | list) -> int                 # median
```

---

## Conversion Commands (`convert.*`)

```python
call("convert.gm_time", timestamp: int) -> str                   # UTC time (HH:MM:SS)
call("convert.gm_date", timestamp: int) -> str                   # UTC date (DD/MM/YYYY)
call("convert.time", timestamp: int) -> str                      # local time (HH:MM:SS)
call("convert.date", timestamp: int) -> str                      # local date (DD/MM/YYYY)
call("convert.elapsed_time", timestamp: int) -> str              # elapsed since timestamp (HH:MM:SS)
call("convert.kb", bytes: int) -> str                            # bytes to "XX.X KB"
call("convert.mb", bytes: int) -> str                            # bytes to "XX.X MB"
call("convert.xb", bytes: int) -> str                            # bytes to human-readable (KB/MB/GB/TB)
call("convert.throttle", bytes: int) -> str                      # bytes to throttle display string
```

---

## Elapsed Time Commands

```python
call("elapsed.less", start_time: int, duration: int) -> bool     # (now - start) < duration
call("elapsed.greater", start_time: int, duration: int) -> bool  # (now - start) > duration
```

---

## Color Commands (`color.*`)

Each color has a getter and setter. Available colors:

```python
call("color.<name>") -> str                                      # get color definition
call("color.<name>.set", color_str: str) -> None                 # set color definition
```

Color names: `default`, `focus`, `title`, `label`, `line`, `fg`, `bg`,
`info`, `inactive`, `leech`, `seed`, `tracker_error`, `tracker_warn`,
`info_topic`, `focus_topic`, `download`, `seed`, `done`, `progress`,
`hash`, `ratio`, `client`, `peer`, `completed`, `status`,
`color_odd`, `color_even`, `color_odd_focus`, `color_even_focus`

---

## String Enumeration Commands (`strings.*`)

```python
call("strings.choke_heuristics") -> list[str]                   # choke heuristic names
call("strings.choke_heuristics.upload") -> list[str]             # upload choke heuristic names
call("strings.choke_heuristics.download") -> list[str]           # download choke heuristic names
call("strings.connection_type") -> list[str]                     # connection type names
call("strings.encryption") -> list[str]                          # encryption option names
call("strings.ip_filter") -> list[str]                           # IP filter option names
call("strings.ip_tos") -> list[str]                              # IP TOS option names
call("strings.log_group") -> list[str]                           # log group names
call("strings.tracker_event") -> list[str]                       # tracker event names
call("strings.tracker_mode") -> list[str]                        # tracker mode names
```

---

## Scheduler Commands

```python
call("scheduler.max_active") -> int                               # max active downloads (-1=unlimited, get/set)

# Download-targeted scheduler hooks:
call("scheduler.simple.added", target: str) -> None               # resume if room in active view
call("scheduler.simple.removed", target: str) -> None             # pause and promote next from started view
call("scheduler.simple.update", target: str) -> None              # rebalance active/started views
```

---

## File Output / Group Insert

```python
call("file.append", path: str, *values: any) -> None            # append values to file

call("group.insert", name: str, view: str) -> str               # create ratio group, returns name
```

### Event Argument Placeholders

```python
call("argument.0") -> str                                        # first event argument
call("argument.1") -> str                                        # second event argument
call("argument.2") -> str                                        # third event argument
call("argument.3") -> str                                        # fourth event argument
```

---

## Lua Commands

```python
call("lua.execute", code: str) -> any                            # execute Lua code
call("lua.execute.str", code: str) -> str                        # execute Lua, return as string
```

---

## Dynamic Ratio Groups

When `group.insert(name, view)` is called, the following commands are created dynamically:

```python
call("group.<name>.ratio.enable") -> None                        # enable ratio checking (starts scheduler)
call("group.<name>.ratio.disable") -> None                       # disable ratio checking
call("group.<name>.ratio.command") -> str                        # command to run when ratio met (get/set)
call("group.<name>.view") -> str                                 # view name for this group (get/set)
call("group.<name>.ratio.min") -> int                            # minimum ratio (default: 200 = 2.0) (get/set)
call("group.<name>.ratio.max") -> int                            # maximum ratio (default: 300 = 3.0) (get/set)
call("group.<name>.ratio.upload") -> int                         # minimum upload amount in bytes (default: 20MB) (get/set)
```

When `method.use_intermediate >= 3`, deprecated aliases are also created:

```python
call("group2.<name>.view") -> str                                # alias for group.<name>.view
call("group2.<name>.ratio.min") -> int                           # alias
call("group2.<name>.ratio.max") -> int                           # alias
call("group2.<name>.ratio.upload") -> int                        # alias
# ... and their .set variants
```

---

## Notes on Empty Default Arguments

- `call("f.multicall", target, filter: str = "", ...)` — empty filter means "all files"
- `call("download_list", view: str = "default") -> list[str]` — empty view means "default"
- `call("d.multicall2", view: str = "default", ...)` — empty view means "default"
- `call("throttle.up.max", name: str = "") -> int` — empty name means "global throttle"
- `call("throttle.down.max", name: str = "") -> int` — empty name means "global throttle"

# References
- https://raw.githubusercontent.com/wiki/rakshasa/rtorrent/Command%E2%80%90Reference%E2%80%90Complete.md
