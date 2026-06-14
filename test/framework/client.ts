import type { ClientId } from "../../src/shared/client-metadata"
import type { TorrentClientFeatures } from "../../src/shared/ipc-contract"

export interface TestClient {
  key: string
  clientId: ClientId
  features: TorrentClientFeatures
  fixture: string
  version: string
  username: string
  password: string
  host: string
  port: number
  containerPort: number
  proxyPort?: number
  acceptHttpStatus: number
  stopLabel: string
  downloadLabel: string
  saveLocation?: string
}

type TestClientInput = Omit<TestClient, "host" | "acceptHttpStatus" | "stopLabel" | "downloadLabel">
  & Partial<Pick<TestClient, "host" | "acceptHttpStatus" | "stopLabel" | "downloadLabel">>

const qbittorrentFeatures: TorrentClientFeatures = {
  magnetLinks: true,
  labels: true,
  fileSelection: true,
  setLocation: true,
  torrentDetails: true,
  trackerFilter: true,
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
}

function defineClient(client: TestClientInput): TestClient {
  return {
    host: "localhost",
    acceptHttpStatus: 200,
    stopLabel: "Stopped",
    downloadLabel: "Downloading",
    ...client,
  }
}

export const TEST_CLIENTS: Record<string, TestClient> = {
  "deluge:1": defineClient({
    key: "deluge:1",
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
    port: 18112,
    containerPort: 8112,
    username: "admin",
    password: "deluge",
    stopLabel: "Paused",
  }),
  "deluge:2": defineClient({
    key: "deluge:2",
    clientId: "deluge",
    features: {
      magnetLinks: true,
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
    version: "2.2.0",
    port: 28112,
    containerPort: 8112,
    username: "admin",
    password: "deluge",
    stopLabel: "Paused",
  }),
  "qbittorrent:4": defineClient({
    key: "qbittorrent:4",
    clientId: "qbittorrent",
    features: qbittorrentFeatures,
    fixture: "fixtures/qbittorrent",
    version: "4.6.7",
    port: 18080,
    containerPort: 8080,
    username: "admin",
    password: "adminadmin",
  }),
  "qbittorrent:5": defineClient({
    key: "qbittorrent:5",
    clientId: "qbittorrent",
    features: qbittorrentFeatures,
    fixture: "fixtures/qbittorrent",
    version: "5.1.0",
    port: 28080,
    containerPort: 8080,
    username: "admin",
    password: "adminadmin",
  }),
  "qbittorrent:latest": defineClient({
    key: "qbittorrent:latest",
    clientId: "qbittorrent",
    features: qbittorrentFeatures,
    fixture: "fixtures/qbittorrent",
    version: "latest",
    port: 38080,
    containerPort: 8080,
    username: "admin",
    password: "adminadmin",
  }),
  transmission: defineClient({
    key: "transmission",
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
    version: "latest",
    port: 19091,
    containerPort: 9091,
    username: "username",
    password: "password",
    acceptHttpStatus: 401,
  }),
  rtorrent: defineClient({
    key: "rtorrent",
    clientId: "rtorrent",
    features: {
      magnetLinks: true,
      labels: true,
      torrentDetails: true,
      trackerFilter: true,
      uploadOptions: {
        saveLocation: true,
        startTorrent: true,
      },
    },
    fixture: "fixtures/rtorrent",
    version: "latest",
    port: 48080,
    containerPort: 80,
    proxyPort: 80,
    username: "admin",
    password: "admin",
    saveLocation: "/downloads/custom/save/location",
  }),
  utorrent: defineClient({
    key: "utorrent",
    clientId: "utorrent",
    features: {
      magnetLinks: true,
      labels: true,
      uploadOptions: {
        saveLocation: true,
      },
    },
    fixture: "fixtures/utorrent",
    version: "latest",
    port: 58080,
    containerPort: 8080,
    username: "admin",
    password: "",
    acceptHttpStatus: 400,
    saveLocation: "/utorrent/custom/save/location",
  }),
}
