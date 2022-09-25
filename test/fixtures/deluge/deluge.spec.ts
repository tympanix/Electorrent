import { createTestSuite } from "../../testlib";
import { FeatureSet } from "../../testutil";

createTestSuite({
  client: "deluge",
  fixture: "fixtures/deluge",
  port: 8112,
  username: "admin",
  password: "deluge",
  stopLabel: "Paused",
  unsupportedFeatures: [
    FeatureSet.Labels,
    FeatureSet.AdvancedUploadOptions,
  ],
});
