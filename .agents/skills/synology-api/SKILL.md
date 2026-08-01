---
name: synology-api
description: >
  Synology Download Station Web API reference covering API discovery,
  authentication, request format, common errors, and Download Station task
  operations.
---

# Skill: Synology Download Station API

## Purpose

Use this skill when you need to integrate with Synology DSM Download Station through its Web API.

## Request format

All requests use `/webapi/<CGI_PATH>` with these core query parameters:

- `api=<API_NAME>`
- `version=<VERSION>`
- `method=<METHOD>`
- additional method-specific params
- session via `_sid=<SID>` or cookie

General form:

```text
GET /webapi/<CGI_PATH>?api=<API_NAME>&version=<VERSION>&method=<METHOD>[&<PARAMS>][&_sid=<SID>]
```

## Response format

All responses are JSON objects with:

- `success`: `true` or `false`
- `data`: method result on success
- `error`: integer error code on failure

## Common error codes

| Code | Meaning |
|---|---|
| 100 | Unknown error |
| 101 | Invalid parameter |
| 102 | Requested API does not exist |
| 103 | Requested method does not exist |
| 104 | Requested version does not support the functionality |
| 105 | Logged-in session does not have permission |
| 106 | Session timeout |
| 107 | Session interrupted by duplicate login |

## API discovery

Start with `SYNO.API.Info`.

- fixed path: `/webapi/query.cgi`
- query available APIs:

```text
/webapi/query.cgi?api=SYNO.API.Info&version=1&method=query&query=ALL
```

Electorrent specifically needs:

- `SYNO.API.Auth`
- `SYNO.DownloadStation.Task`

## Authentication

### `SYNO.API.Auth`

- path is discovered from `SYNO.API.Info` (commonly `auth.cgi`)
- login:

```text
/webapi/auth.cgi?api=SYNO.API.Auth&version=2&method=login&account=<user>&passwd=<pass>&session=DownloadStation&format=cookie
```

Important params:

- `account`
- `passwd`
- `session=DownloadStation`
- `format=cookie` or `format=sid`
- optional `otp_code`

Logout:

```text
/webapi/auth.cgi?api=SYNO.API.Auth&version=1&method=logout&session=DownloadStation
```

Auth-specific error codes:

| Code | Meaning |
|---|---|
| 400 | No such account or incorrect password |
| 401 | Account disabled |
| 402 | Permission denied |
| 403 | 2-step verification code required |
| 404 | Failed to authenticate 2-step verification code |

## Download Station API families

| API | Purpose |
|---|---|
| `SYNO.DownloadStation.Info` | Package info and settings |
| `SYNO.DownloadStation.Schedule` | Schedule settings |
| `SYNO.DownloadStation.Task` | List tasks and perform task actions |
| `SYNO.DownloadStation.Statistic` | Total download/upload stats |
| `SYNO.DownloadStation.RSS.Site` | RSS site list/refresh |
| `SYNO.DownloadStation.RSS.Feed` | RSS feed list |
| `SYNO.DownloadStation.BTSearch` | BT search operations |

## `SYNO.DownloadStation.Task`

### `list`

Request params:

- `offset` optional, default `0`
- `limit` optional, default `-1`
- `additional` optional comma-separated expansions:
  - `detail`
  - `transfer`
  - `file`
  - `tracker`
  - `peer`

Example:

```text
/webapi/DownloadStation/task.cgi?api=SYNO.DownloadStation.Task&version=1&method=list&additional=detail,file
```

Returns:

- `total`
- `offset`
- `tasks[]`

Task objects include fields such as:

- `id`
- `type`
- `username`
- `title`
- `size`
- `status`
- `status_extra`
- optional `additional.detail`, `additional.transfer`, `additional.file`, `additional.tracker`, `additional.peer`

### `getinfo`

Params:

- `id=dbid_001,dbid_002`
- optional `additional=detail,transfer,file,tracker,peer`

Returns `tasks[]`.

### `create`

Used to add downloads.

Params:

- `uri` optional: HTTP / FTP / magnet / ED2K links, or shared-folder file paths
- `file` optional: uploaded torrent/NZB payload
- `username` optional
- `password` optional
- `unzip_password` optional
- `destination` optional shared-folder-relative destination

This is typically a `POST` for uploads.

### `delete`

Params:

- `id`
- `force_complete`

Returns per-task result objects containing:

- `id`
- `error` (`0` means success)

### `pause`

Params:

- `id`

Returns per-task result objects with `id` and `error`.

### `resume`

Params:

- `id`

Returns per-task result objects with `id` and `error`.

### `edit`

Commonly used to change destination.

Params:

- `id`
- `destination`

Returns per-task result objects with `id` and `error`.

## Task error codes

Useful task-specific codes:

| Code | Meaning |
|---|---|
| 400 | File upload failed |
| 401 | Max number of tasks reached |
| 402 | Destination denied |
| 403 | Destination does not exist |
| 404 | Invalid task id |
| 405 | Invalid task action |
| 406 | No default destination |
| 407 | Set destination failed |
| 408 | File does not exist |

## Electorrent usage

Electorrent uses:

1. `SYNO.API.Info` query for API discovery
2. `SYNO.API.Auth` login
3. `SYNO.DownloadStation.Task.list`
4. `SYNO.DownloadStation.Task.create` for URL and file uploads
5. `SYNO.DownloadStation.Task.pause`
6. `SYNO.DownloadStation.Task.resume`
7. `SYNO.DownloadStation.Task.delete`

## Reference

- https://global.download.synology.com/download/Document/Software/DeveloperGuide/Package/DownloadStation/All/enu/Synology_Download_Station_Web_API.pdf
