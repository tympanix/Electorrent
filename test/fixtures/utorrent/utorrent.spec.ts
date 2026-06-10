import { createTestSuite } from "../../testlib";

createTestSuite({
  clientId: "utorrent",
  features: {
    magnetLinks: true,
    labels: true,
    uploadOptions: {
      saveLocation: true,
    },
  },
  fixture: "fixtures/utorrent",
  port: 8080,
  username: "admin",
  password: "",
  acceptHttpStatus: 400,
  saveLocation: "/utorrent/custom/save/location",
});
