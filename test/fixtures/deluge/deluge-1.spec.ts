import { createTestSuite } from "../../testlib";

createTestSuite({
  clientId: "deluge",
  features: {
    labels: true,
    torrentDetails: true,
    uploadOptions: {
      saveLocation: true,
      category: true,
      startTorrent: true,
      peerLimit: true,
      firstAndLastPiecePrio: true,
      downloadSpeedLimit: true,
      uploadSpeedLimit: true,
    },
  },
  fixture: "fixtures/deluge",
  version: "5b398f77-ls22",
  port: 8112,
  username: "admin",
  password: "deluge",
  stopLabel: "Paused",
});
