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

createTestSuite({
  client: new QBittorrentClient(),
  fixture: "fixtures/qbittorrent",
  version: "5.1.0",
  port: 8080,
  username: "admin",
  password: "adminadmin",
  unsupportedFeatures: [],
});

createTestSuite({
  client: new QBittorrentClient(),
  fixture: "fixtures/qbittorrent",
  version: "4.6.7",
  port: 8080,
  username: "admin",
  password: "adminadmin",
  unsupportedFeatures: [],
});

createTestSuite({
  client: new QBittorrentClient(),
  fixture: "fixtures/qbittorrent",
  version: "3.3.15",
  port: 8080,
  username: "admin",
  password: "adminadmin",
  unsupportedFeatures: [],
});
