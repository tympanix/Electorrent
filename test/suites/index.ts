import { createTestSuite } from "../testlib"
import { FeatureSet } from "../testutil";

export default function() {
  createTestSuite({
    client: "transmission",
    fixture: "fixtures/transmission",
    port: 9091,
    username: "username",
    password: "password",
    acceptHttpStatus: 401,
    unsupportedFeatures: [
      FeatureSet.Labels,
      FeatureSet.AdvancedUploadOptions,
    ],
  });

  createTestSuite({
    client: "deluge",
    fixture: "fixtures/deluge",
    port: 8112,
    username: "admin",
    password: "deluge",
    stopLabel: "Paused",
    unsupportedFeatures: [
      FeatureSet.Labels,
      FeatureSet.AdvancedUploadOptions,
    ],
  });

  createTestSuite({
    client: "utorrent",
    fixture: "fixtures/utorrent",
    port: 8080,
    username: "admin",
    password: "",
    acceptHttpStatus: 400,
    unsupportedFeatures: [
      FeatureSet.AdvancedUploadOptions,
    ],
  });

  createTestSuite({
    client: "rtorrent",
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

  createTestSuite({
    client: "qbittorrent",
    fixture: "fixtures/qbittorrent",
    port: 8080,
    username: "admin",
    password: "adminadmin",
    unsupportedFeatures: [
      FeatureSet.AdvancedUploadOptions,
    ],
  });
}