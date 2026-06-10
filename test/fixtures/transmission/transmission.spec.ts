import { createTestSuite } from "../../testlib";

createTestSuite({
  clientId: "transmission",
  features: {
    magnetLinks: true,
    labels: true,
    setLocation: true,
    torrentDetails: true,
    trackerFilter: true,
    uploadOptions: {
      saveLocation: true,
      category: true,
      startTorrent: true,
      peerLimit: true,
      sequentialDownload: true,
      downloadSpeedLimit: true,
      uploadSpeedLimit: true,
    },
  },
  fixture: "fixtures/transmission",
  port: 9091,
  username: "username",
  password: "password",
  acceptHttpStatus: 401,
});
