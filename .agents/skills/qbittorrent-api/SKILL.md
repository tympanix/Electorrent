---
name: qbittorrent-api
description: >
  qBittorrent WebUI API reference covering authentication, sync, transfer,
  torrent, RSS, and search endpoints for qBittorrent 5.0+.
---

# Skill: qBittorrent API

## Purpose

Use this skill when you need to integrate with qBittorrent's WebUI API.

## Protocol

- Base path: `/api/v2`
- Reads usually use `GET`; mutations use `POST`
- Wrong method returns `405 Method Not Allowed` on modern servers
- All routes require authentication except `/api/v2/auth/login`

## Authentication

qBittorrent uses cookie-based auth.

- `POST /api/v2/auth/login`
  - form params: `username`, `password`
  - success returns `200` and sets `SID` cookie
  - failed-rate-limit ban returns `403`
- `POST /api/v2/auth/logout`

Send `Referer` or `Origin` matching the request host/port.

## Common route groups

| Group | Base | Notes |
|---|---|---|
| Auth | `/api/v2/auth/*` | Login/logout |
| Application | `/api/v2/app/*` | Version, preferences, cookies, save path |
| Log | `/api/v2/log/*` | Main log and peer log |
| Sync | `/api/v2/sync/*` | Incremental state updates |
| Transfer | `/api/v2/transfer/*` | Global rates and limits |
| Torrents | `/api/v2/torrents/*` | List, inspect, mutate, files, categories, tags |
| RSS | `/api/v2/rss/*` | Feed and rule management |
| Search | `/api/v2/search/*` | Search jobs and plugins |

## Most important endpoints

### Application

- `GET /app/version`
- `GET /app/webapiVersion`
- `GET /app/buildInfo`
- `GET /app/preferences`
- `POST /app/setPreferences`
  - form/json param: `json={...}`
- `GET /app/defaultSavePath`
- `GET /app/cookies`
- `POST /app/setCookies`

### Sync

- `GET /sync/maindata?rid=<rid>`
  - returns `rid`, `full_update`, `torrents`, `torrents_removed`, `categories`, `categories_removed`, `tags`, `tags_removed`, `server_state`
- `GET /sync/torrentPeers?hash=<hash>&rid=<rid>`

Use `sync/maindata` for efficient polling instead of repeatedly calling full torrent list endpoints.

### Transfer

- `GET /transfer/info`
- `GET /transfer/speedLimitsMode`
- `POST /transfer/toggleSpeedLimitsMode`
- `GET /transfer/downloadLimit`
- `POST /transfer/setDownloadLimit`
  - param: `limit` bytes/sec
- `GET /transfer/uploadLimit`
- `POST /transfer/setUploadLimit`
  - param: `limit` bytes/sec
- `POST /transfer/banPeers`
  - param: `peers=host:port|host:port`

### Torrent listing and inspection

- `GET /torrents/info`
  - filters: `filter`, `category`, `tag`, `sort`, `reverse`, `limit`, `offset`, `hashes`
- `GET /torrents/properties?hash=<hash>`
- `GET /torrents/trackers?hash=<hash>`
- `GET /torrents/webseeds?hash=<hash>`
- `GET /torrents/files?hash=<hash>`
- `GET /torrents/pieceStates?hash=<hash>`
- `GET /torrents/pieceHashes?hash=<hash>`

Important `torrents/info` response fields include state, progress, rates, ETA, save path, category, tags, tracker, queue position, availability, and content sizes.

### Torrent lifecycle and mutation

- `POST /torrents/pause`
- `POST /torrents/resume`
- `POST /torrents/delete`
  - params: `hashes`, `deleteFiles`
- `POST /torrents/recheck`
- `POST /torrents/reannounce`
- `POST /torrents/add`
  - multipart fields:
    - `urls`
    - `torrents` (repeatable file part)
    - optional `savepath`, `category`, `tags`, `skip_checking`, `paused`, `root_folder`, `rename`, `upLimit`, `dlLimit`, `ratioLimit`, `seedingTimeLimit`, `autoTMM`, `sequentialDownload`, `firstLastPiecePrio`
- `POST /torrents/addTrackers`
- `POST /torrents/editTracker`
- `POST /torrents/removeTrackers`
- `POST /torrents/addPeers`

### Priority and per-file control

- `POST /torrents/increasePrio`
- `POST /torrents/decreasePrio`
- `POST /torrents/topPrio`
- `POST /torrents/bottomPrio`
- `POST /torrents/filePrio`
  - params: `hash`, `id`, `priority`
  - use `index` from `/torrents/files` when available

### Limits, location, and naming

- `POST /torrents/downloadLimit`
- `POST /torrents/setDownloadLimit`
- `POST /torrents/setShareLimits`
- `POST /torrents/uploadLimit`
- `POST /torrents/setUploadLimit`
- `POST /torrents/setLocation`
- `POST /torrents/rename`
- `POST /torrents/setCategory`
- `GET /torrents/categories`
- `POST /torrents/createCategory`
- `POST /torrents/editCategory`
- `POST /torrents/removeCategories`
- `POST /torrents/addTags`
- `POST /torrents/removeTags`
- `GET /torrents/tags`
- `POST /torrents/createTags`
- `POST /torrents/deleteTags`
- `POST /torrents/setAutoManagement`
- `POST /torrents/toggleSequentialDownload`
- `POST /torrents/toggleFirstLastPiecePrio`
- `POST /torrents/setForceStart`
- `POST /torrents/setSuperSeeding`
- `POST /torrents/renameFile`
- `POST /torrents/renameFolder`

## RSS and search

RSS is under `/api/v2/rss/*` and search is under `/api/v2/search/*`.

Important endpoints:

- RSS: `addFolder`, `addFeed`, `removeItem`, `moveItem`, `items`, `markAsRead`, `refreshItem`, rule CRUD, `articles`
- Search: `start`, `stop`, `status`, `results`, `delete`, plugin list/install/uninstall/enable/update`

## Electorrent usage

Electorrent primarily depends on:

- auth login/logout
- `sync/maindata`
- `torrents/add`
- `torrents/files` + `torrents/filePrio`
- pause/resume/recheck/delete
- priority operations
- category management
- sequential download and first/last piece priority toggles

## References

- https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-5.0)
- https://raw.githubusercontent.com/wiki/qbittorrent/qBittorrent/WebUI-API-(qBittorrent-5.0).md
