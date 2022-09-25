import { createTestSuite } from "../../testlib";
import { FeatureSet } from "../../testutil";

createTestSuite({
  client: "qbittorrent",
  fixture: "fixtures/qbittorrent",
  port: 8080,
  username: "admin",
  password: "adminadmin",
  unsupportedFeatures: [
    FeatureSet.AdvancedUploadOptions,
  ],
});