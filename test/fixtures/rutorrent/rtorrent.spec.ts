import { createTestSuite } from "../../testlib";
import { FeatureSet } from "../../testutil";
import { RtorrentClient } from "../../../src/scripts/bittorrent"

createTestSuite({
  client: new RtorrentClient(),
  fixture: "fixtures/rutorrent",
  port: 8080,
  proxyPort: 80,
  acceptHttpStatus: 200,
  username: "admin",
  password: "admin",
  unsupportedFeatures: [
    FeatureSet.AdvancedUploadOptions,
  ],
});
