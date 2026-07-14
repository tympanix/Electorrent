import type { TorrentClientFeatures } from "../../../src/shared/ipc-contract"
import type { TestClient } from "../types"
import { defineClient } from "../define"

const features = {
  magnetLinks: true,
  labels: true,
  setLocation: true,
  torrentDetails: true,
  trackerFilter: true,
  speedLimits: true,
  ratioLimits: true,
  freeDiskSpace: true,
  uploadOptions: {
    saveLocation: true,
    category: true,
    startTorrent: true,
    peerLimit: true,
    sequentialDownload: true,
    downloadSpeedLimit: true,
    uploadSpeedLimit: true,
  },
} satisfies TorrentClientFeatures

export default {
  transmission: defineClient({
    key: "transmission",
    clientId: "transmission",
    features,
    fixture: "clients/transmission",
    version: "latest",
    port: 19091,
    containerPort: 9091,
    username: "username",
    password: "password",
    acceptHttpStatus: 401,
    downloadRoot: "/downloads",
  }),
} satisfies Record<string, TestClient>
