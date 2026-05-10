import { createTestSuite } from "../../testlib";

import { QBittorrentClient } from "../../../src/scripts/bittorrent"

createTestSuite({
  client: new QBittorrentClient(),
  fixture: "fixtures/qbittorrent",
  version: "latest",
  port: 8080,
  username: "admin",
  password: "adminadmin",
  unsupportedFeatures: [],
});
