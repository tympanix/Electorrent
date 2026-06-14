import request from "request"

import type {
    BittorrentFileSelection,
    BittorrentServerConfig,
    BittorrentTorrentDetailsData,
    TorrentClientConnection,
} from "@shared/ipc-contract"
import { cleanPath, defer, HTTP_REQUEST_TIMEOUT } from "@main/lib/bittorrent/helpers"
import type { BittorrentRuntime } from "@main/lib/bittorrent/types"
import { QBittorrentApiV1 } from "./api-v1"
import { QBittorrentApiV2 } from "./api-v2"
import type { QBittorrentBaseApi } from "./base-api"

const QBITTORRENT_PRIORITY_SKIP = 0
const QBITTORRENT_PRIORITY_NORMAL = 1

function buildClientPath(server: BittorrentServerConfig, endpoint: string) {
    const prefix = cleanPath(server.path)
    const suffix = endpoint.replace(/^\/+/, "")

    return prefix ? `${prefix}/${suffix}` : `/${suffix}`
}

export class QBittorrentRuntime implements BittorrentRuntime {
    private api: QBittorrentBaseApi | null = null

    private async selectApi(server: BittorrentServerConfig) {
        const origin = `${server.proto}://${server.ip}:${server.port}`
        const requestOptions = {
            timeout: HTTP_REQUEST_TIMEOUT,
            ca: server.certificateData,
            method: "GET",
            headers: {
                Referer: origin,
            },
            uri: `${origin}${buildClientPath(server, "version/api")}`,
        }

        const hasLegacyApi = await new Promise<boolean>((resolve) => {
            request(requestOptions, (err: any, res: any) => resolve(!err && res?.statusCode === 200))
        })

        const options = {
            origin,
            path: cleanPath(server.path),
            user: server.user,
            pass: server.password,
            ca: server.certificateData,
            timeout: HTTP_REQUEST_TIMEOUT,
        }

        return hasLegacyApi ? new QBittorrentApiV1(options) : new QBittorrentApiV2(options)
    }

    private getApi() {
        if (!this.api) {
            throw new Error("qBittorrent session is not connected")
        }

        return this.api
    }

    async connect(server: BittorrentServerConfig): Promise<TorrentClientConnection> {
        const api = await this.selectApi(server)
        this.api = api
        await defer((done) => api.login(done))
        const version = await defer<string>((done) => api.getVersion(done))
        if (typeof version !== "string" || !version.trim()) {
            throw new Error("qBittorrent did not return its version")
        }

        return {
            version: version.trim().replace(/^v(?=\d)/i, ""),
            features: {
                magnetLinks: true,
                labels: true,
                fileSelection: true,
                setLocation: true,
                torrentDetails: true,
                trackerFilter: api.supportsTrackerFilter,
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
        }
    }

    async getSnapshot(fullUpdate?: boolean): Promise<any> {
        const api = this.getApi()

        if (fullUpdate) {
            await defer<void>((done) => api.reset((err) => done(err)))
        }

        const data = await defer<any>((done) => api.syncMaindata(done))
        await this.addTrackersToSnapshot(data)
        return data
    }

    private async addTrackersToSnapshot(data: any) {
        const api = this.getApi()
        const torrents = data?.torrents
        if (!api.supportsTrackerFilter || !torrents || typeof torrents !== "object") {
            return
        }

        await Promise.all(Object.entries(torrents).map(async ([hash, torrent]) => {
            if (!torrent || typeof torrent !== "object") {
                return
            }

            const torrentData = torrent as Record<string, any>
            const trackers = await defer<any[]>((done) => api.getTorrentTrackers(hash, done))
            torrentData.trackers = Array.isArray(trackers)
                ? trackers.map((tracker) => tracker?.url).filter((url) => typeof url === "string" && url.length > 0)
                : []
        }))
    }

    private getHttpUploadOptions(options?: Record<string, any>) {
        if (!options) {
            return undefined
        }

        return Object.fromEntries(
            Object.entries({
                savepath: options.saveLocation,
                category: options.category,
                skip_checking: options.skipCheck,
                paused: !options.startTorrent,
                stopped: !options.startTorrent,
                rename: options.renameTorrent,
                upLimit: options.uploadSpeedLimit,
                dlLimit: options.downloadSpeedLimit,
                sequentialDownload: options.sequentialDownload,
                firstLastPiecePrio: options.firstAndLastPiecePrio,
            })
                .filter(([, value]) => value !== undefined && value !== null)
                .map(([key, value]) => [key, value.toString()]),
        )
    }

    addTorrentUrl(uri: string, options?: Record<string, any>): Promise<void> {
        const api = this.getApi()
        return defer((done) => api.addTorrentURL(uri, this.getHttpUploadOptions(options), done))
    }

    uploadTorrent(buffer: Uint8Array, filename: string, options?: Record<string, any>): Promise<void> {
        const api = this.getApi()
        return defer((done) => api.addTorrentFileContent(Buffer.from(buffer), filename, this.getHttpUploadOptions(options), done))
    }

    resume(hashes: string[]): Promise<void> {
        const api = this.getApi()
        return defer((done) => api.resume(hashes, done))
    }

    resumeAll(): Promise<void> {
        const api = this.getApi()
        return defer((done) => api.resumeAll(done))
    }

    pause(hashes: string[]): Promise<void> {
        const api = this.getApi()
        return defer((done) => api.pause(hashes, done))
    }

    pauseAll(): Promise<void> {
        const api = this.getApi()
        return defer((done) => api.pauseAll(done))
    }

    recheck(hashes: string[]): Promise<void> {
        const api = this.getApi()
        return defer((done) => api.recheck(hashes, done))
    }

    increasePrio(hashes: string[]): Promise<void> {
        const api = this.getApi()
        return defer((done) => api.increasePrio(hashes, done))
    }

    decreasePrio(hashes: string[]): Promise<void> {
        const api = this.getApi()
        return defer((done) => api.decreasePrio(hashes, done))
    }

    topPrio(hashes: string[]): Promise<void> {
        const api = this.getApi()
        return defer((done) => api.topPrio(hashes, done))
    }

    bottomPrio(hashes: string[]): Promise<void> {
        const api = this.getApi()
        return defer((done) => api.bottomPrio(hashes, done))
    }

    toggleSequentialDownload(hashes: string[]): Promise<void> {
        const api = this.getApi()
        return defer((done) => api.toggleSequentialDownload(hashes, done))
    }

    delete(hashes: string[]): Promise<void> {
        const api = this.getApi()
        return defer((done) => api.delete(hashes, done))
    }

    deleteAndRemove(hashes: string[]): Promise<void> {
        const api = this.getApi()
        return defer((done) => api.deleteAndRemove(hashes, done))
    }

    async setCategory(hashes: string[], category: string, create?: boolean): Promise<void> {
        const api = this.getApi()

        if (create === true) {
            await defer((done) => api.createCategory(category, "", done))
        }

        await defer((done) => api.setCategory(hashes, category, done))
    }

    async setLocation(hashes: string[], location: string, resumeHashes: string[] = []): Promise<void> {
        const api = this.getApi()
        await this.pause(hashes)
        await defer((done) => api.setLocation(hashes, location, done))

        if (resumeHashes.length > 0) {
            await this.resume(resumeHashes)
        }
    }

    async getTorrentDetails(hash: string): Promise<BittorrentTorrentDetailsData> {
        const api = this.getApi()
        const [properties, files] = await Promise.all([
            new Promise<Record<string, any>>((resolve, reject) => {
                api.getJson("torrents/properties", { qs: { hash } }, (err: any, _res: any, body: any) => {
                    if (err) {
                        reject(err)
                        return
                    }

                    resolve(body || {})
                })
            }),
            this.getTorrentFiles(hash),
        ])

        if (!Array.isArray(files)) {
            throw new Error("Invalid torrent files response")
        }

        return {
            info: {
                hash,
                savePath: properties.save_path ?? null,
                creationDate: properties.creation_date ?? null,
                pieceSize: properties.piece_size ?? null,
                comment: properties.comment ?? null,
                totalWasted: properties.total_wasted ?? null,
                totalUploaded: properties.total_uploaded ?? null,
                totalUploadedSession: properties.total_uploaded_session ?? null,
                totalDownloaded: properties.total_downloaded ?? null,
                totalDownloadedSession: properties.total_downloaded_session ?? null,
                uploadLimit: properties.up_limit ?? null,
                downloadLimit: properties.dl_limit ?? null,
                timeElapsed: properties.time_elapsed ?? null,
                seedingTime: properties.seeding_time ?? null,
                connections: properties.nb_connections ?? null,
                connectionsLimit: properties.nb_connections_limit ?? null,
                shareRatio: properties.share_ratio ?? null,
                additionDate: properties.addition_date ?? null,
                completionDate: properties.completion_date ?? null,
                createdBy: properties.created_by ?? null,
                averageDownloadSpeed: properties.dl_speed_avg ?? null,
                downloadSpeed: properties.dl_speed ?? null,
                eta: properties.eta ?? null,
                lastSeen: properties.last_seen ?? null,
                peers: properties.peers ?? null,
                peersTotal: properties.peers_total ?? null,
                piecesHave: properties.pieces_have ?? null,
                piecesTotal: properties.pieces_num ?? null,
                reannounce: properties.reannounce ?? null,
                seeds: properties.seeds ?? null,
                seedsTotal: properties.seeds_total ?? null,
                sequentialDownload: properties.seq_dl ?? null,
                totalSize: properties.total_size ?? null,
                averageUploadSpeed: properties.up_speed_avg ?? null,
                uploadSpeed: properties.up_speed ?? null,
                isPrivate: properties.is_private ?? properties.isPrivate ?? null,
            },
            files: files.map((file: any, idx: number) => {
                const priority = file.priority != null ? Number(file.priority) : undefined
                return {
                    index: file.index != null ? Number(file.index) : idx,
                    path: file.name || "",
                    name: (file.name || "").split(/[/\\]/).pop() || "",
                    size: typeof file.size === "number" ? file.size : (parseInt(String(file.size), 10) || 0),
                    progress: typeof file.progress === "number" ? file.progress : Number(file.progress) || 0,
                    availability: typeof file.availability === "number" ? file.availability : Number(file.availability) || 0,
                    priority,
                    wanted: priority !== QBITTORRENT_PRIORITY_SKIP,
                    isSeed: Boolean(file.is_seed),
                }
            }),
        }
    }

    getTorrentFiles(hash: string): Promise<any> {
        const api = this.getApi()
        return new Promise((resolve, reject) => {
            api.getJson("torrents/files", { qs: { hash } }, (err: any, _res: any, body: any) => {
                if (err) {
                    reject(err)
                    return
                }

                resolve(body)
            })
        })
    }

    async setTorrentFileSelection(hash: string, files: BittorrentFileSelection[]): Promise<void> {
        const api = this.getApi()
        const wantedIds = files.filter((file) => file.wanted).map((file) => file.index)
        const unwantedIds = files.filter((file) => !file.wanted).map((file) => file.index)

        const setPriority = (ids: number[], priority: number) => new Promise<void>((resolve, reject) => {
            if (ids.length === 0) {
                resolve()
                return
            }

            api.post("torrents/filePrio", {
                form: {
                    hash,
                    id: ids.join("|"),
                    priority: String(priority),
                },
            }, (err: any) => {
                if (err) {
                    reject(err)
                    return
                }

                resolve()
            })
        })

        await setPriority(unwantedIds, QBITTORRENT_PRIORITY_SKIP)
        await setPriority(wantedIds, QBITTORRENT_PRIORITY_NORMAL)
    }
}
