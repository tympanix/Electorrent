import type { TorrentClientFeatures } from "../../../src/shared/ipc-contract"
import type { TestClient } from "../types"
import { defineClient } from "../define"

const features = {
  magnetLinks: true,
  labels: true,
  speedLimits: true,
  ratioLimits: false,
  uploadOptions: {
    saveLocation: true,
  },
} satisfies TorrentClientFeatures

export default {
  utorrent: defineClient({
    key: "utorrent",
    clientId: "utorrent",
    features,
    fixture: "clients/utorrent",
    version: "latest",
    port: 58080,
    containerPort: 8080,
    username: "admin",
    password: "",
    acceptHttpStatus: 400,
    saveLocation: "/utorrent/custom/save/location",
  }),
} satisfies Record<string, TestClient>
