import { createTestSuite } from "../../testlib";
import { FeatureSet } from "../../testutil";
import { DelugeClient } from "../../../src/scripts/bittorrent"

createTestSuite({
  client: new DelugeClient(),
  fixture: "fixtures/deluge",
  version: "1",
  port: 8112,
  username: "admin",
  password: "deluge",
  stopLabel: "Paused",
  unsupportedFeatures: [
    FeatureSet.Labels,
    FeatureSet.MagnetLinks,
    FeatureSet.AdvancedUploadOptions,
  ],
});
