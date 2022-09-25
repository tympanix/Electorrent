import { createTestSuite } from "../../testlib";
import { FeatureSet } from "../../testutil";

createTestSuite({
  client: "utorrent",
  fixture: "fixtures/utorrent",
  port: 8080,
  username: "admin",
  password: "",
  acceptHttpStatus: 400,
  unsupportedFeatures: [
    FeatureSet.AdvancedUploadOptions,
  ],
});
