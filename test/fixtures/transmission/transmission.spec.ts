import { createTestSuite } from "../../testlib";
import { FeatureSet } from "../../testutil";

createTestSuite({
  client: "transmission",
  fixture: "fixtures/transmission",
  port: 9091,
  username: "username",
  password: "password",
  acceptHttpStatus: 401,
  unsupportedFeatures: [
    FeatureSet.Labels,
    FeatureSet.AdvancedUploadOptions,
  ],
});
