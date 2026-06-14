import type { TorrentClientFeatures } from "../../../src/shared/ipc-contract"
import type { TestClient } from "../types"
import { defineClient } from "../define"

const features = {
  magnetLinks: true,
  labels: true,
  fileSelection: true,
  setLocation: true,
  torrentDetails: true,
  trackerFilter: true,
  uploadOptions: {
    saveLocation: true,
    renameTorrent: true,
    category: true,
    startTorrent: true,
    skipCheck: true,
    sequentialDownload: true,
    firstAndLastPiecePrio: true,
    downloadSpeedLimit: true,
    uploadSpeedLimit: true,
  },
} satisfies TorrentClientFeatures

export default {
  "qbittorrent:4": defineClient({
    key: "qbittorrent:4",
    clientId: "qbittorrent",
    features,
    fixture: "clients/qbittorrent",
    version: "4.6.7",
    port: 18080,
    containerPort: 8080,
    username: "admin",
    password: "adminadmin",
  }),
  "qbittorrent:5": defineClient({
    key: "qbittorrent:5",
    clientId: "qbittorrent",
    features,
    fixture: "clients/qbittorrent",
    version: "5.1.0",
    port: 28080,
    containerPort: 8080,
    username: "admin",
    password: "adminadmin",
  }),
  "qbittorrent:latest": defineClient({
    key: "qbittorrent:latest",
    clientId: "qbittorrent",
    features,
    fixture: "clients/qbittorrent",
    version: "latest",
    port: 38080,
    containerPort: 8080,
    username: "admin",
    password: "adminadmin",
  }),
} satisfies Record<string, TestClient>
