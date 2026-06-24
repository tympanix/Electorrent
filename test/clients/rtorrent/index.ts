import type { TorrentClientFeatures } from "../../../src/shared/ipc-contract"
import type { TestClient } from "../types"
import { defineClient } from "../define"

const features = {
  magnetLinks: true,
  labels: true,
  torrentDetails: true,
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
    digestAuthProxyHostPort: 48082,
    additionalComposeServices: ["apache"],
    specs: [
      "test/specs/standard/**/*.spec.ts",
      "test/specs/rtorrent/**/*.spec.ts",
    ],
    username: "admin",
    password: "admin",
    saveLocation: "/downloads/custom/save/location",
  }),
} satisfies Record<string, TestClient>
