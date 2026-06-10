import { createTestSuite } from "../../testlib";
import { DelugeClient } from "../../../src/renderer/app/bittorrent"

createTestSuite({
  client: new DelugeClient(),
  fixture: "fixtures/deluge",
  version: "2.2.0",
  port: 8112,
  username: "admin",
  password: "deluge",
  stopLabel: "Paused",
  unsupportedFeatures: [],
});
