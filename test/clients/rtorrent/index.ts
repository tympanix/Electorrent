import type { TorrentClientFeatures } from "../../../src/shared/ipc-contract"
import type { TestClient } from "../types"
import { defineClient } from "../define"

const features = {
  magnetLinks: true,
  labels: true,
  torrentDetails: true,
  trackerFilter: true,
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
    port: 48080,
    containerPort: 80,
    proxyPort: 80,
    username: "admin",
    password: "admin",
    saveLocation: "/downloads/custom/save/location",
  }),
} satisfies Record<string, TestClient>
