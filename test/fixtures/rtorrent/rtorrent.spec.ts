import { createTestSuite } from "../../testlib";
import { RtorrentClient } from "../../../src/renderer/app/bittorrent"

createTestSuite({
  client: new RtorrentClient(),
  fixture: "fixtures/rtorrent",
  port: 8080,
  proxyPort: 80,
  acceptHttpStatus: 200,
  username: "admin",
  password: "admin",
  saveLocation: "/downloads/custom/save/location",
  unsupportedFeatures: [],
});
