import { createTestSuite } from "../../testlib";
import { UtorrentClient } from "../../../src/renderer/app/bittorrent"

createTestSuite({
  client: new UtorrentClient(),
  fixture: "fixtures/utorrent",
  port: 8080,
  username: "admin",
  password: "",
  acceptHttpStatus: 400,
  saveLocation: "/utorrent/custom/save/location",
  unsupportedFeatures: [],
});
