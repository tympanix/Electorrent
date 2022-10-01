import { createTestSuite } from "../../testlib";
import { FeatureSet } from "../../testutil";

import { QBittorrentClient } from "../../../src/scripts/bittorrent"

createTestSuite({
  client: new QBittorrentClient(),
  fixture: "fixtures/qbittorrent",
  port: 8080,
  username: "admin",
  password: "adminadmin",
  unsupportedFeatures: [],
});