/**
 * Minimal fake Transmission RPC server serving a large, realistic torrent list.
 * Used by the UI performance benchmark to reproduce issue #843 without a real seedbox.
 *
 * Honors the `fields` and `ids` (including "recently-active") arguments of `torrent-get`,
 * so the payload size reflects exactly what Electorrent requests.
 */
import http from "node:http"
import crypto from "node:crypto"

const SESSION_ID = "electorrent-benchmark-session"

function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function createTorrent(index: number) {
  const random = seeded(index + 1)
  const fileCount = random() < 0.1 ? 100 + Math.floor(random() * 200) : 1 + Math.floor(random() * 20)
  const pieceCount = 500 + Math.floor(random() * 4000)
  const pieceSize = 1024 * 1024
  const totalSize = pieceCount * pieceSize
  const percentDone = random() < 0.8 ? 1 : Number(random().toFixed(3))
  const status = percentDone === 1 ? 6 : 4
  const peerCount = Math.floor(random() * 20)
  const hashString = crypto.createHash("sha1").update(`torrent-${index}`).digest("hex")
  const name = `Benchmark.Torrent.${index.toString().padStart(4, "0")}.1080p.WEB-DL`
  const files = Array.from({ length: fileCount }, (_, file) => ({
    name: `${name}/Season 01/${name}.E${file.toString().padStart(3, "0")}.mkv`,
    length: Math.floor(totalSize / fileCount),
    bytesCompleted: Math.floor(totalSize / fileCount * percentDone),
    beginPiece: Math.floor(pieceCount / fileCount * file),
    endPiece: Math.floor(pieceCount / fileCount * (file + 1)),
  }))
  const trackers = [0, 1, 2].map((tier) => ({
    announce: `https://tracker${tier}.example.org:443/announce`,
    id: tier,
    scrape: `https://tracker${tier}.example.org:443/scrape`,
    sitename: "example",
    tier,
  }))

  return {
    activityDate: 1_700_000_000 + index,
    addedDate: 1_690_000_000 + index * 60,
    availability: Array.from({ length: pieceCount }, () => (percentDone === 1 ? -1 : Math.floor(random() * 10))),
    bandwidthPriority: 0,
    comment: "Benchmark torrent ".repeat(5),
    corruptEver: 0,
    creator: "mktorrent 1.1",
    dateCreated: 1_680_000_000,
    desiredAvailable: 0,
    doneDate: percentDone === 1 ? 1_695_000_000 + index : 0,
    downloadDir: "/downloads/complete/tv",
    downloadedEver: Math.floor(totalSize * percentDone),
    downloadLimit: 100,
    downloadLimited: false,
    editDate: 0,
    error: 0,
    errorString: "",
    eta: percentDone === 1 ? -1 : Math.floor(random() * 10000),
    etaIdle: -1,
    "file-count": fileCount,
    files,
    fileStats: files.map((file) => ({ bytesCompleted: file.bytesCompleted, priority: 0, wanted: true })),
    group: "",
    hashString,
    haveUnchecked: 0,
    haveValid: Math.floor(totalSize * percentDone),
    honorsSessionLimits: true,
    id: index + 1,
    isFinished: false,
    isPrivate: true,
    isStalled: false,
    labels: [`label-${index % 7}`],
    leftUntilDone: Math.floor(totalSize * (1 - percentDone)),
    magnetLink: `magnet:?xt=urn:btih:${hashString}&dn=${encodeURIComponent(name)}${trackers.map((tracker) => `&tr=${encodeURIComponent(tracker.announce)}`).join("")}`,
    manualAnnounceTime: -1,
    maxConnectedPeers: 50,
    metadataPercentComplete: 1,
    name,
    peers: Array.from({ length: peerCount }, (_, peer) => ({
      address: `10.0.${index % 255}.${peer}`,
      clientName: "qBittorrent 4.6.0",
      clientIsChoked: false,
      clientIsInterested: true,
      flagStr: "TDEI",
      isDownloadingFrom: true,
      isEncrypted: true,
      isIncoming: false,
      isUploadingTo: true,
      isUTP: false,
      peerIsChoked: false,
      peerIsInterested: true,
      port: 51413,
      progress: random(),
      rateToClient: Math.floor(random() * 100000),
      rateToPeer: Math.floor(random() * 100000),
    })),
    peersConnected: peerCount,
    peersFrom: { fromCache: 0, fromDht: peerCount, fromIncoming: 0, fromLpd: 0, fromLtep: 0, fromPex: 0, fromTracker: 0 },
    peersGettingFromUs: Math.floor(peerCount / 2),
    peersSendingToUs: Math.floor(peerCount / 3),
    percentComplete: percentDone,
    percentDone,
    pieceCount,
    pieces: Buffer.alloc(Math.ceil(pieceCount / 8), percentDone === 1 ? 0xff : 0xa5).toString("base64"),
    pieceSize,
    priorities: files.map(() => 0),
    "primary-mime-type": "video/x-matroska",
    queuePosition: index,
    rateDownload: percentDone === 1 ? 0 : Math.floor(random() * 1_000_000),
    rateUpload: Math.floor(random() * 200_000),
    recheckProgress: 0,
    secondsDownloading: 3600,
    secondsSeeding: 86400,
    seedIdleLimit: 30,
    seedIdleMode: 0,
    seedRatioLimit: 2,
    seedRatioMode: 0,
    sequentialDownload: false,
    sizeWhenDone: totalSize,
    startDate: 1_699_000_000,
    status,
    torrentFile: `/config/torrents/${hashString}.torrent`,
    totalSize,
    trackers,
    trackerStats: trackers.map((tracker) => ({
      ...tracker,
      announceState: 1,
      downloadCount: 100,
      hasAnnounced: true,
      hasScraped: true,
      host: `https://tracker${tracker.tier}.example.org:443`,
      isBackup: false,
      lastAnnouncePeerCount: 50,
      lastAnnounceResult: "Success",
      lastAnnounceStartTime: 1_700_000_000,
      lastAnnounceSucceeded: true,
      lastAnnounceTime: 1_700_000_000,
      lastAnnounceTimedOut: false,
      lastScrapeResult: "",
      lastScrapeStartTime: 1_700_000_000,
      lastScrapeSucceeded: true,
      lastScrapeTime: 1_700_000_000,
      lastScrapeTimedOut: false,
      leecherCount: 10,
      nextAnnounceTime: 1_700_001_000,
      nextScrapeTime: 1_700_001_000,
      scrapeState: 1,
      seederCount: 100,
    })),
    uploadedEver: Math.floor(totalSize * random() * 3),
    uploadLimit: 100,
    uploadLimited: false,
    uploadRatio: Number((random() * 3).toFixed(2)),
    wanted: files.map(() => 1),
    webseeds: [],
    webseedsSendingToUs: 0,
  }
}

export interface FakeTransmissionStats {
  requests: number
  torrentGetRequests: number
  torrentGetBytes: number[]
}

export function startFakeTransmission(port: number, torrentCount: number) {
  const torrents = Array.from({ length: torrentCount }, (_, index) => createTorrent(index))
  const stats: FakeTransmissionStats = { requests: 0, torrentGetRequests: 0, torrentGetBytes: [] }

  const server = http.createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on("data", (chunk) => chunks.push(chunk))
    request.on("end", () => {
      stats.requests += 1
      if (request.headers["x-transmission-session-id"] !== SESSION_ID) {
        response.writeHead(409, { "X-Transmission-Session-Id": SESSION_ID })
        response.end()
        return
      }

      const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")
      let result: Record<string, unknown> = {}
      if (body.method === "session-get") {
        result = { version: "4.0.6 (benchmark)", "rpc-version": 17, "download-dir-free-space": 1024 ** 4 }
      } else if (body.method === "torrent-get") {
        const fields: string[] = body.arguments?.fields || []
        const ids = body.arguments?.ids
        let selected = torrents
        if (Array.isArray(ids)) {
          selected = torrents.filter((torrent) => ids.includes(torrent.hashString) || ids.includes(torrent.id))
        } else if (ids === "recently-active") {
          selected = torrents.filter((torrent) => torrent.rateDownload > 0 || torrent.rateUpload > 0)
        }
        result = {
          torrents: selected.map((torrent) => Object.fromEntries(fields.filter((field) => field in torrent).map((field) => [field, (torrent as any)[field]]))),
          ...(ids === "recently-active" ? { removed: [] } : {}),
        }
      }

      const payload = JSON.stringify({ arguments: result, result: "success" })
      if (body.method === "torrent-get") {
        stats.torrentGetRequests += 1
        stats.torrentGetBytes.push(Buffer.byteLength(payload))
      }
      response.writeHead(200, { "Content-Type": "application/json", "X-Transmission-Session-Id": SESSION_ID })
      response.end(payload)
    })
  })

  return new Promise<{ stats: FakeTransmissionStats, close: () => Promise<void> }>((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve({
      stats,
      close: () => new Promise((done) => server.close(() => done())),
    }))
  })
}
