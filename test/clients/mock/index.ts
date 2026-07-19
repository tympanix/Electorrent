import { defineClient } from "../define"
import type { TorrentClientFeatures } from "../../../src/shared/ipc-contract"

const features = {
  magnetLinks: true,
  labels: true,
  fileSelection: true,
  uploadFileSelection: true,
  setLocation: true,
  torrentDetails: true,
  torrentPeers: true,
  freeDiskSpace: true,
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
  mock: defineClient({
    key: "mock",
    clientId: "mock",
    features,
    version: "1.0.0",
    username: "",
    password: "",
    host: "localhost",
    port: 1,
    specs: ["test/specs/mock/**/*.spec.ts"],
    appArgs: ["-d", "--force-title-bar-menu", "--update-url=http://127.0.0.1:43871/update"],
  }),
}
