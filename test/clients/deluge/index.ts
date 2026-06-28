import type { TorrentClientFeatures } from "../../../src/shared/ipc-contract"
import type { TestClient } from "../types"
import { defineClient } from "../define"

const baseFeatures = {
  labels: true,
  uploadFileSelection: true,
  torrentDetails: true,
  speedLimits: true,
  ratioLimits: true,
  freeDiskSpace: true,
  uploadOptions: {
    saveLocation: true,
    category: true,
    startTorrent: true,
    peerLimit: true,
    firstAndLastPiecePrio: true,
    downloadSpeedLimit: true,
    uploadSpeedLimit: true,
  },
} satisfies TorrentClientFeatures

export default {
  "deluge:1": defineClient({
    key: "deluge:1",
    clientId: "deluge",
    features: baseFeatures,
    fixture: "clients/deluge",
    version: "5b398f77-ls22",
    port: 18112,
    containerPort: 8112,
    username: "admin",
    password: "deluge",
    stopLabel: "Paused",
    downloadRoot: "/downloads",
  }),
  "deluge:2": defineClient({
    key: "deluge:2",
    clientId: "deluge",
    features: {
      ...baseFeatures,
      magnetLinks: true,
    },
    fixture: "clients/deluge",
    version: "2.2.0",
    port: 28112,
    containerPort: 8112,
    username: "admin",
    password: "deluge",
    stopLabel: "Paused",
    downloadRoot: "/downloads",
  }),
} satisfies Record<string, TestClient>
