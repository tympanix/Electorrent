import { createTestSuite } from "../../testlib";

import { QBittorrentClient } from "../../../src/renderer/app/bittorrent"

createTestSuite({
  client: new QBittorrentClient(),
  fixture: "fixtures/qbittorrent",
  version: "4.6.7",
  port: 8080,
  username: "admin",
  password: "adminadmin",
  unsupportedFeatures: [],
});
