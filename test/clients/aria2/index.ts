import type { TorrentClientFeatures } from "../../../src/shared/ipc-contract"
import type { TestClient } from "../types"
import { defineClient } from "../define"

const features = {
  magnetLinks: true,
  labels: false,
  fileSelection: true,
  uploadFileSelection: true,
  setLocation: false,
  torrentDetails: true,
  torrentPeers: true,
  trackerFilter: true,
  alternativeSpeedLimits: false,
  speedLimits: true,
  ratioLimits: true,
  freeDiskSpace: false,
  uploadOptions: {
    saveLocation: true,
    renameTorrent: false,
    category: false,
    startTorrent: true,
    skipCheck: true,
    peerLimit: true,
    sequentialDownload: false,
    firstAndLastPiecePrio: true,
    downloadSpeedLimit: true,
    uploadSpeedLimit: true,
  },
} satisfies TorrentClientFeatures

export default {
  aria2: defineClient({
    key: "aria2",
    clientId: "aria2",
    features,
    fixture: "clients/aria2",
    version: "edge",
    port: 16800,
    containerPort: 6800,
    username: "",
    password: "password",
    acceptHttpStatus: 400,
    acceptHttpPath: "/jsonrpc",
  }),
} satisfies Record<string, TestClient>
