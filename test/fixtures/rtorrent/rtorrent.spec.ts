import { createTestSuite } from "../../testlib";

createTestSuite({
  clientId: "rtorrent",
  features: {
    magnetLinks: true,
    labels: true,
    torrentDetails: true,
    trackerFilter: true,
    uploadOptions: {
      saveLocation: true,
      startTorrent: true,
    },
  },
  fixture: "fixtures/rtorrent",
  port: 8080,
  proxyPort: 80,
  acceptHttpStatus: 200,
  username: "admin",
  password: "admin",
  saveLocation: "/downloads/custom/save/location",
});
