import { createTestSuite } from "../../testlib";
import { FeatureSet } from "../../testutil";
import { RtorrentClient } from "../../../src/renderer/app/bittorrent"

createTestSuite({
  client: new RtorrentClient(),
  fixture: "fixtures/rtorrent",
  port: 8080,
  proxyPort: 80,
  acceptHttpStatus: 200,
  username: "admin",
  password: "admin",
  unsupportedFeatures: [
    FeatureSet.AdvancedUploadOptions,
  ],
});
