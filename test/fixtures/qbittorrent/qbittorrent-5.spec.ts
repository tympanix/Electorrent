import { createTestSuite } from "../../testlib";

import { QBittorrentClient } from "../../../src/scripts/bittorrent"

createTestSuite({
  client: new QBittorrentClient(),
  fixture: "fixtures/qbittorrent",
  version: "5.1.0",
  port: 8080,
  username: "admin",
  password: "adminadmin",
  unsupportedFeatures: [],
});
