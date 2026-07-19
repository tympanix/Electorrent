import type { TorrentClientFeatures } from "../../../src/shared/ipc-contract"
import type { TestClient } from "../types"
import { defineClient } from "../define"

const features = {
  magnetLinks: true,
  labels: true,
  uploadFileSelection: true,
  torrentDetails: true,
  torrentPeers: true,
  trackerFilter: true,
  speedLimits: true,
  uploadOptions: {
    saveLocation: true,
    startTorrent: true,
  },
} satisfies TorrentClientFeatures

export default {
  rtorrent: defineClient({
    key: "rtorrent",
    clientId: "rtorrent",
    features,
    fixture: "clients/rtorrent",
    version: "latest",
    port: 48081,
    containerPort: 80,
    containerHostPort: 48080,
    proxyPort: 80,
    authProxyHostPort: 48081,
    username: "admin",
    password: "admin",
    downloadRoot: "/downloads",
    saveLocation: "/downloads/custom/save/location",
  }),
  "rtorrent:latest": defineClient({
    key: "rtorrent-crazymax",
    clientId: "rtorrent",
    features,
    fixture: "clients/rtorrent-crazymax",
    version: "5.3.1-0.16.13",
    port: 48083,
    containerPort: 8080,
    containerHostPort: 48082,
    proxyPort: 8000,
    authProxyHostPort: 48083,
    username: "admin",
    password: "admin",
    downloadRoot: "/downloads",
    saveLocation: "/downloads/custom/save/location",
  }),
} satisfies Record<string, TestClient>
