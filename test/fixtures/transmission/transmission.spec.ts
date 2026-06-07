import { createTestSuite } from "../../testlib";
import { TransmissionClient } from "../../../src/renderer/app/bittorrent"

createTestSuite({
  client: new TransmissionClient(),
  fixture: "fixtures/transmission",
  port: 9091,
  username: "username",
  password: "password",
  acceptHttpStatus: 401,
  unsupportedFeatures: [],
});
