import { createTestSuite } from "../../testlib";
import { FeatureSet } from "../../testutil";
import { TransmissionClient } from "../../../src/renderer/app/bittorrent"

createTestSuite({
  client: new TransmissionClient(),
  fixture: "fixtures/transmission",
  port: 9091,
  username: "username",
  password: "password",
  acceptHttpStatus: 401,
  unsupportedFeatures: [
    FeatureSet.Labels,
  ],
});
