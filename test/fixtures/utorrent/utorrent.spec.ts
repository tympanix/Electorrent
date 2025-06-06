import { createTestSuite } from "../../testlib";
import { FeatureSet } from "../../testutil";
import { UtorrentClient } from "../../../src/scripts/bittorrent"

createTestSuite({
  client: new UtorrentClient(),
  fixture: "fixtures/utorrent",
  port: 8080,
  username: "admin",
  password: "",
  acceptHttpStatus: 400,
  unsupportedFeatures: [
    FeatureSet.AdvancedUploadOptions
  ],
});
