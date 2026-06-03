import fs from "fs";
import http from "http";
import os from "os";
import path from "path";

const packageVersion = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")).version;
const updatePlatform = process.platform === "win32"
  ? "win32"
  : process.platform === "darwin"
    ? "dmg"
    : "appimage";

export const UPDATE_FIXTURE_PORT = 19876;
export const TEST_UPDATE_URL = `http://127.0.0.1:${UPDATE_FIXTURE_PORT}/update/${updatePlatform}/${packageVersion}`;
export const TEST_UPDATE_DOWNLOADS_PATH = path.join(os.tmpdir(), "electorrent-wdio-downloads");
export const TEST_UPDATE_DOWNLOAD_ARTIFACT_PATH = path.join(TEST_UPDATE_DOWNLOADS_PATH, "electorrent-update-test.AppImage");
export const TEST_UPDATE_INSTALL_MARKER_PATH = `${TEST_UPDATE_DOWNLOAD_ARTIFACT_PATH}.install-target`;
export const UPDATE_TEST_FIXTURE_OPTIONS: UpdateHookOptions = {
  nextVersion: "99.0.0",
  releaseNotes: "Update fixture notes",
  releaseDate: "2026-06-03T00:00:00.000Z",
};

type UpdateHookOptions = {
  currentVersion?: string
  nextVersion?: string
  releaseNotes?: string
  releaseDate?: string
  filename?: string
  downloadBody?: string
};

type FixtureState = {
  currentVersion: string
  nextVersion: string
  releaseNotes: string
  releaseDate: string
  filename: string
  downloadBody: string
  updateAvailable: boolean
  feedRequests: number
  downloadRequests: number
  requestUrls: string[]
};

let server: http.Server | null = null;
let state = createFixtureState();

function createFixtureState(options: UpdateHookOptions = {}): FixtureState {
  const nextVersion = options.nextVersion || "99.0.0";

  return {
    currentVersion: options.currentVersion || packageVersion,
    nextVersion,
    releaseNotes: options.releaseNotes || "Update fixture notes",
    releaseDate: options.releaseDate || "2026-06-03T00:00:00.000Z",
    filename: options.filename || `electorrent-${nextVersion}.AppImage`,
    downloadBody: options.downloadBody || "#!/bin/sh\necho electorrent update fixture\n",
    updateAvailable: !!options.nextVersion,
    feedRequests: 0,
    downloadRequests: 0,
    requestUrls: [],
  };
}

function ensureDownloadsPath() {
  fs.mkdirSync(TEST_UPDATE_DOWNLOADS_PATH, { recursive: true });
}

function resetDownloadsPath() {
  fs.rmSync(TEST_UPDATE_DOWNLOADS_PATH, { recursive: true, force: true });
  ensureDownloadsPath();
}

function createServer() {
  return http.createServer((req, res) => {
    if (!req.url) {
      res.writeHead(400);
      res.end("missing url");
      return;
    }

    state.requestUrls.push(req.url);

    if (req.url.startsWith(`/update/${updatePlatform}/${state.currentVersion}`)) {
      state.feedRequests += 1;

      if (!state.updateAvailable) {
        res.writeHead(204);
        res.end();
        return;
      }

      const payload = JSON.stringify({
        name: state.nextVersion,
        notes: state.releaseNotes,
        pub_date: state.releaseDate,
        url: `http://127.0.0.1:${UPDATE_FIXTURE_PORT}/download/${state.filename}`,
      });

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      });
      res.end(payload);
      return;
    }

    if (req.url === `/download/${state.filename}`) {
      state.downloadRequests += 1;
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${state.filename}"`,
        "Content-Length": Buffer.byteLength(state.downloadBody),
      });
      res.end(state.downloadBody);
      return;
    }

    res.writeHead(404);
    res.end("not found");
  });
}

async function startServer() {
  if (server) {
    return;
  }

  server = createServer();
  await new Promise<void>((resolve) => {
    server?.listen(UPDATE_FIXTURE_PORT, "127.0.0.1", () => resolve());
  });
}

async function stopServer() {
  if (!server) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server?.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  server = null;
}

function configureUpdateFixture(options: UpdateHookOptions = {}) {
  state = createFixtureState(options);
  resetDownloadsPath();
}

export function updateHooks(options: UpdateHookOptions = {}) {
  const service = {
    getRequestCounts() {
      return {
        feed: state.feedRequests,
        download: state.downloadRequests,
      };
    },
    getRequestUrls() {
      return [...state.requestUrls];
    },
    getDownloadedFiles() {
      ensureDownloadsPath();
      return fs.readdirSync(TEST_UPDATE_DOWNLOADS_PATH).sort();
    },
    getDownloadedFilePath() {
      if (!fs.existsSync(TEST_UPDATE_DOWNLOAD_ARTIFACT_PATH)) {
        throw new Error("No update artifact has been downloaded");
      }

      return TEST_UPDATE_DOWNLOAD_ARTIFACT_PATH;
    },
  };

  before(async function () {
    this.timeout(30 * 1000);
    configureUpdateFixture(options);
    await startServer();
  });

  after(async function () {
    this.timeout(30 * 1000);
    await stopServer();
    configureUpdateFixture();
  });

  return service;
}
