import { createTestSuite } from "../../testlib";

import { QBittorrentClient } from "../../../src/scripts/bittorrent"

createTestSuite({
  client: new QBittorrentClient(),
  fixture: "fixtures/qbittorrent",
  version: "5",
  port: 8080,
  username: "admin",
  password: "adminadmin",
  unsupportedFeatures: [],
});

createTestSuite({
  client: new QBittorrentClient(),
  fixture: "fixtures/qbittorrent",
  version: "4",
  port: 8080,
  username: "admin",
  password: "adminadmin",
  unsupportedFeatures: [],
});

createTestSuite({
  client: new QBittorrentClient(),
  fixture: "fixtures/qbittorrent",
  version: "3",
  port: 8080,
  username: "admin",
  password: "adminadmin",
  unsupportedFeatures: [],
});
