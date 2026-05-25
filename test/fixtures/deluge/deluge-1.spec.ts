import { createTestSuite } from "../../testlib";
import { FeatureSet } from "../../testutil";
import { DelugeClient } from "../../../src/renderer/app/bittorrent"

createTestSuite({
  client: new DelugeClient(),
  fixture: "fixtures/deluge",
  version: "5b398f77-ls22",
  port: 8112,
  username: "admin",
  password: "deluge",
  stopLabel: "Paused",
  unsupportedFeatures: [
    FeatureSet.Labels,
    FeatureSet.MagnetLinks,
  ],
});
