import { URL } from "node:url"
import request from "request"

import type {
    BittorrentFileSelection,
    BittorrentServerConfig,
    BittorrentTorrentDetailsData,
    TorrentClientConnection,
} from "@shared/ipc-contract"
import { defer, HTTP_REQUEST_TIMEOUT, serverOriginUrl, serverUrl, urlPath } from "@main/lib/bittorrent/helpers"
import type { BittorrentRuntime } from "@main/lib/bittorrent/types"
import { QBittorrentApiV1 } from "./api-v1"
import { QBittorrentApiV2 } from "./api-v2"
import type { QBittorrentBaseApi } from "./base-api"

const QBITTORRENT_PRIORITY_SKIP = 0
const QBITTORRENT_PRIORITY_NORMAL = 1

export class QBittorrentRuntime implements BittorrentRuntime {
    private url(server: BittorrentServerConfig, endpoint?: string) {
        return serverUrl(server, endpoint)
    }

    private api: QBittorrentBaseApi | null = null

    private trackerToHashes = new Map<string, Set<string>>()

    private torrentCache = new Map<string, Record<string, any>>()

    private async selectApi(server: BittorrentServerConfig) {
        const origin = serverOriginUrl(server)
        const requestOptions = {
            timeout: HTTP_REQUEST_TIMEOUT,
            ca: server.certificateData,
            method: "GET",
            headers: {
                Referer: origin,
            },
            uri: this.url(server, "version/api"),
        }

        const hasLegacyApi = await new Promise<boolean>((resolve) => {
            request(requestOptions, (err: any, res: any) => resolve(!err && res?.statusCode === 200))
        })

        const options = {
            origin,
            path: urlPath(server.path),
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
        this.trackerToHashes.clear()
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
                trackerFilter: true,
                alternativeSpeedLimits: true,
                speedLimits: true,
                freeDiskSpace: true,
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
            await defer<void>((done) => api.reset(done))
            this.trackerToHashes.clear()
            this.torrentCache.clear()
        }

        const data = await defer<Record<string, any>>((done) => api.syncMaindata(done))
        if (data?.full_update) {
            this.torrentCache.clear()
        }

        const changedTrackerHashes = new Set<string>()
        this.mergeTrackerCache(data, changedTrackerHashes)
        this.removeRemovedTrackerUrls(data?.trackers_removed, changedTrackerHashes)
        this.removeDeletedTorrentHashes(data?.torrents_removed, changedTrackerHashes)
        this.mergeTorrentCache(data)
        this.prepareTrackerData(data, changedTrackerHashes)

        if (data?.server_state && data.server_state.use_alt_speed_limits === undefined) {
            data.server_state.use_alt_speed_limits = await defer<boolean>((done) => api.getSpeedLimitsMode(done))
        }

        return data
    }

    private mergeTorrentCache(data: Record<string, any>) {
        const torrents = data?.torrents && typeof data.torrents === "object" ? data.torrents : {}

        Object.entries(torrents).forEach(([hash, torrent]) => {
            if (!torrent || typeof torrent !== "object" || Array.isArray(torrent)) {
                return
            }

            const merged = {
                ...(this.torrentCache.get(hash) || {}),
                ...torrent,
            }
            this.torrentCache.set(hash, merged)
            torrents[hash] = merged
        })
    }

    private mergeTrackerCache(data: Record<string, any>, changedHashes: Set<string>) {
        const trackers = data?.trackers || data?.tracker

        if (!trackers || typeof trackers !== "object" || Array.isArray(trackers)) {
            return
        }

        Object.entries(trackers).forEach(([tracker, hashes]) => {
            if (!Array.isArray(hashes)) {
                return
            }

            const hashSet = this.trackerToHashes.get(tracker) || new Set<string>()
            hashes.forEach((hash) => {
                if (typeof hash === "string") {
                    hashSet.add(hash)
                    changedHashes.add(hash)
                }
            })

            if (hashSet.size > 0) {
                this.trackerToHashes.set(tracker, hashSet)
            }
        })
    }

    private removeRemovedTrackerUrls(trackers: any, changedHashes: Set<string>) {
        if (!Array.isArray(trackers) || trackers.length === 0) {
            return
        }

        trackers.forEach((tracker) => {
            if (typeof tracker !== "string") {
                return
            }

            const hashes = this.trackerToHashes.get(tracker)
            hashes?.forEach((hash) => changedHashes.add(hash))
            this.trackerToHashes.delete(tracker)
        })
    }

    private removeDeletedTorrentHashes(hashes: any, changedHashes: Set<string>) {
        if (!Array.isArray(hashes) || hashes.length === 0) {
            return
        }

        const deletedHashes = new Set(hashes.filter((hash): hash is string => typeof hash === "string"))
        deletedHashes.forEach((hash) => {
            changedHashes.delete(hash)
            this.torrentCache.delete(hash)
        })
        this.trackerToHashes.forEach((trackerHashes, tracker) => {
            deletedHashes.forEach((hash) => trackerHashes.delete(hash))
            if (trackerHashes.size === 0) {
                this.trackerToHashes.delete(tracker)
            }
        })
    }

    private prepareTrackerData(data: Record<string, any>, changedHashes: Set<string>) {
        const torrents = data.torrents && typeof data.torrents === "object" ? data.torrents : {}
        data.torrents = torrents

        Object.keys(torrents).forEach((hash) => changedHashes.add(hash))
        changedHashes.forEach((hash) => {
            const torrentData = torrents[hash] && typeof torrents[hash] === "object"
                ? torrents[hash]
                : { ...(this.torrentCache.get(hash) || {}) }
            torrentData.trackers = this.getTorrentTrackerHosts(hash)
            torrents[hash] = torrentData
            if (this.torrentCache.has(hash)) {
                this.torrentCache.set(hash, torrentData)
            }
        })

        data.trackers = this.getAllTrackerHosts()
        delete data.tracker
    }

    private getTorrentTrackerHosts(hash: string) {
        const trackers = new Set<string>()
        this.trackerToHashes.forEach((hashes, tracker) => {
            if (hashes.has(hash)) {
                trackers.add(this.parseTrackerHost(tracker))
            }
        })
        return [...trackers]
    }

    private getAllTrackerHosts() {
        const trackers = new Set<string>()
        this.trackerToHashes.forEach((_hashes, tracker) => trackers.add(this.parseTrackerHost(tracker)))
        return [...trackers]
    }

    private parseTrackerHost(tracker: string) {
        try {
            return new URL(tracker).hostname || tracker
        } catch (_err) {
            return tracker
        }
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
                upLimit: options.uploadSpeedLimit === undefined ? undefined : Number(options.uploadSpeedLimit) * 1024,
                dlLimit: options.downloadSpeedLimit === undefined ? undefined : Number(options.downloadSpeedLimit) * 1024,
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

    setAlternativeSpeedLimitsMode(_hashes: string[], enabled: boolean): Promise<void> {
        const api = this.getApi()
        return defer((done) => api.setSpeedLimitsMode(enabled, done))
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

    async setSpeedLimits(hashes: string[], options: Record<string, any>): Promise<void> {
        const api = this.getApi()
        const requests: Promise<void>[] = []

        if (options.downloadSpeedLimit !== undefined) {
            requests.push(defer((done) => api.setDownloadLimit(hashes, Number(options.downloadSpeedLimit) * 1024, done)))
        }
        if (options.uploadSpeedLimit !== undefined) {
            requests.push(defer((done) => api.setUploadLimit(hashes, Number(options.uploadSpeedLimit) * 1024, done)))
        }

        await Promise.all(requests)
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
