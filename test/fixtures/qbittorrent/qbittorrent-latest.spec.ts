import { createTestSuite } from "../../testlib";

createTestSuite({
  clientId: "qbittorrent",
  features: {
    magnetLinks: true,
    labels: true,
    fileSelection: true,
    setLocation: true,
    torrentDetails: true,
    uploadOptions: {
      saveLocation: true,
      renameTorrent: true,
      category: true,
      startTorrent: true,
      skipCheck: true,
      sequentialDownload: true,
      firstAndLastPiecePrio: true,
      downloadSpeedLimit: true,
      uploadSpeedLimit: true,
    },
  },
  fixture: "fixtures/qbittorrent",
  version: "latest",
  port: 8080,
  username: "admin",
  password: "adminadmin",
});
