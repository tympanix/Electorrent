import request from "request"
import parseTorrent from "parse-torrent"

import type { BittorrentFileSelection, BittorrentServerConfig, BittorrentTorrentDetailsData, TorrentClientConnection } from "@shared/ipc-contract"
import {
    defer,
    HTTP_LOGIN_TIMEOUT,
    HTTP_REQUEST_TIMEOUT,
    serverUrl,
} from "@main/lib/bittorrent/helpers"
import type { BittorrentRuntime } from "@main/lib/bittorrent/types"

const DELUGE_TORRENT_FIELDS = [
    "completed_time",
    "distributed_copies",
    "download_payload_rate",
    "eta",
    "is_auto_managed",
    "label",
    "max_connections",
    "max_download_speed",
    "max_upload_speed",
    "name",
    "num_peers",
    "num_seeds",
    "progress",
    "queue",
    "ratio",
    "save_path",
    "seeds_peers_ratio",
    "stop_at_ratio",
    "stop_ratio",
    "state",
    "time_added",
    "total_done",
    "total_peers",
    "total_seeds",
    "total_uploaded",
    "total_wanted",
    "tracker_host",
    "upload_payload_rate",
]

const DELUGE_TORRENT_DETAIL_FIELDS = [
    ...DELUGE_TORRENT_FIELDS,
    "files",
    "file_progress",
    "file_priorities",
    "message",
    "active_time",
    "seeding_time",
    "num_pieces",
    "piece_length",
    "distributed_copies",
    "completed_time",
    "last_seen_complete",
    "owner",
    "super_seeding",
    "seed_rank",
    "time_since_transfer",
]

export class DelugeRuntime implements BittorrentRuntime {
    private url(server: BittorrentServerConfig, endpoint?: string) {
        return serverUrl(server, endpoint)
    }

    private requestId = 0

    private rpcUrl = ""

    private uploadUrl = ""

    private requestOptions: Record<string, any> = {}

    private supportsLabels = false

    private downloadLocation: string | null = null

    private getUploadOptions(options?: Record<string, any>) {
        if (!options) {
            return {}
        }

        const fileSelection = Array.isArray(options.fileSelection)
            ? options.fileSelection as BittorrentFileSelection[]
            : []
        const filePriorities = fileSelection.length > 0
            ? fileSelection.reduce<number[]>((priorities, file) => {
                priorities[file.index] = file.wanted ? 1 : 0
                return priorities
            }, [])
            : undefined

        return Object.fromEntries(
            Object.entries({
                download_location: options.saveLocation || undefined,
                add_paused: options.startTorrent === undefined ? undefined : !options.startTorrent,
                max_connections: options.peerLimit,
                max_download_speed: options.downloadSpeedLimit,
                max_upload_speed: options.uploadSpeedLimit,
                prioritize_first_last_pieces: options.firstAndLastPiecePrio,
                label: options.category,
                file_priorities: filePriorities,
            }).filter(([, value]) => value !== undefined && value !== null),
        )
    }

    private rpc(method: string, params: any[], cb: (err: any, value?: any) => void, timeout = HTTP_REQUEST_TIMEOUT) {
        request({
            ...this.requestOptions,
            timeout,
            method: "POST",
            json: true,
            gzip: true,
            url: this.rpcUrl,
            body: {
                method,
                params,
                id: this.requestId++,
            },
        }, (err: any, res: any, body: any) => {
            if (err) {
                cb(err)
                return
            }

            if (!res || res.statusCode !== 200) {
                cb(new Error("Invalid response from deluge API"))
                return
            }

            if (body?.error) {
                cb(new Error(body.error.message))
                return
            }

            cb(null, body?.result)
        })
    }

    private uploadTorrentPayload(torrent: Uint8Array | Buffer, cb: (err: any, body?: any) => void) {
        const uploadRequest = request({
            ...this.requestOptions,
            method: "POST",
            url: this.uploadUrl,
            json: true,
            gzip: true,
        }, (err: any, _res: any, body: any) => cb(err, body))

        uploadRequest.form().append("file", Buffer.isBuffer(torrent) ? torrent : Buffer.from(torrent), {
            contentType: "application/x-bittorrent",
        })
    }

    private addUploadedTorrent(path: string, config: Record<string, any> | undefined, cb: (err: any, value?: any) => void) {
        const options: Record<string, any> = {
            file_priorities: [],
            add_paused: false,
            compact_allocation: false,
            max_connections: -1,
            max_download_speed: -1,
            max_upload_slots: -1,
            max_upload_speed: -1,
            prioritize_first_last_pieces: false,
            ...config,
        }
        delete options.label

        this.rpc("web.add_torrents", [[{ path, options }]], cb)
    }

    private async applyUploadedTorrentLabel(hash: string | undefined, label?: string) {
        if (!label) {
            return
        }

        if (!hash) {
            throw new Error("Unable to determine the uploaded torrent hash")
        }

        await this.setLabel([hash], label)
    }

    private isMagnetUrl(uri: string) {
        return uri.toLowerCase().startsWith("magnet:?")
    }

    private async getCoreConfigValues(keys: string[]) {
        return defer<Record<string, any>>((done) => this.rpc("core.get_config_values", [keys], done))
    }

    private async resolveMagnetConfig(config?: Record<string, any>) {
        if (config?.download_location) {
            return config
        }

        const coreConfig = await this.getCoreConfigValues(["download_location"])
        if (!coreConfig?.download_location) {
            throw new Error("Missing download location in Deluge core config")
        }

        return {
            download_location: coreConfig.download_location,
            ...config,
        }
    }

    private async getHosts() {
        return defer<any[]>((done) => this.rpc("web.get_hosts", [], done))
    }

    async connect(server: BittorrentServerConfig): Promise<TorrentClientConnection> {
        this.rpcUrl = this.url(server, "json")
        this.uploadUrl = this.url(server, "upload")
        this.requestId = 0
        this.requestOptions = {
            timeout: HTTP_REQUEST_TIMEOUT,
            ca: server.certificateData,
            strictSSL: server.tlsSecurity !== "insecure",
            jar: request.jar(),
        }

        await defer((done) => this.rpc("auth.login", [server.password], done, HTTP_LOGIN_TIMEOUT))

        const hosts = await this.getHosts()
        const hostId = hosts[0]?.[0]
        if (!hostId) {
            throw new Error("Deluge did not return any hosts")
        }

        const methods = await defer<string[]>((done) => this.rpc("web.connect", [hostId], done))
        const hostStatus = await defer<string[]>((done) => this.rpc("web.get_host_status", [hostId], done))
        const version = hostStatus?.[hostStatus.length - 1]
        if (typeof version !== "string" || !version.trim()) {
            throw new Error("Deluge did not return its version")
        }

        try {
            const enabledPlugins = await defer<string[]>((done) => this.rpc("core.get_enabled_plugins", [], done))
            this.supportsLabels = Array.isArray(enabledPlugins) && enabledPlugins.includes("Label")
        } catch {
            this.supportsLabels = false
        }

        const coreConfig = await this.getCoreConfigValues(["download_location"])
        this.downloadLocation = typeof coreConfig?.download_location === "string" && coreConfig.download_location.trim()
            ? coreConfig.download_location
            : null

        return {
            version: version.trim(),
            features: {
                magnetLinks: Array.isArray(methods) && methods.includes("core.add_torrent_magnet"),
                labels: this.supportsLabels,
                uploadFileSelection: true,
                torrentDetails: true,
                speedLimits: true,
                ratioLimits: true,
                freeDiskSpace: true,
                uploadOptions: {
                    saveLocation: true,
                    category: this.supportsLabels,
                    startTorrent: true,
                    peerLimit: true,
                    firstAndLastPiecePrio: true,
                    downloadSpeedLimit: true,
                    uploadSpeedLimit: true,
                },
            },
        }
    }

    async getSnapshot(): Promise<any> {
        const fields = this.supportsLabels
            ? DELUGE_TORRENT_FIELDS
            : DELUGE_TORRENT_FIELDS.filter((field) => field !== "label")
        const [snapshot, labels, freeDiskSpace] = await Promise.all([
            defer<Record<string, any>>((done) => this.rpc("web.update_ui", [fields, {}], done)),
            this.supportsLabels
                ? defer<string[]>((done) => this.rpc("label.get_labels", [], done))
                : Promise.resolve([]),
            this.getFreeDiskSpace(),
        ])

        return {
            ...snapshot,
            labels: Array.isArray(labels) ? labels : [],
            freeDiskSpace,
        }
    }

    private async getFreeDiskSpace(): Promise<number | null> {
        if (!this.downloadLocation) {
            return null
        }

        const value = await defer<number>((done) => this.rpc("core.get_free_space", [this.downloadLocation], done))
        const numeric = typeof value === "number" ? value : Number(value)
        return Number.isFinite(numeric) && numeric >= 0 ? numeric : null
    }

    async getTorrentDetails(hash: string): Promise<BittorrentTorrentDetailsData> {
        const details = await defer<Record<string, any>>((done) => this.rpc("web.get_torrent_status", [hash, DELUGE_TORRENT_DETAIL_FIELDS], done))
        const files = Array.isArray(details.files) ? details.files : []
        const fileProgress = Array.isArray(details.file_progress) ? details.file_progress : []
        const filePriorities = Array.isArray(details.file_priorities) ? details.file_priorities : []

        return {
            info: {
                hash,
                savePath: details.save_path ?? null,
                pieceSize: details.piece_length ?? null,
                totalDownloaded: details.total_done ?? null,
                totalUploaded: details.total_uploaded ?? null,
                uploadLimit: details.max_upload_speed ?? null,
                downloadLimit: details.max_download_speed ?? null,
                timeElapsed: details.active_time ?? null,
                seedingTime: details.seeding_time ?? null,
                connectionsLimit: details.max_connections ?? null,
                shareRatio: details.ratio ?? null,
                ratioLimit: details.stop_at_ratio ? (details.stop_ratio ?? null) : null,
                additionDate: details.time_added ?? null,
                completionDate: details.completed_time ?? null,
                downloadSpeed: details.download_payload_rate ?? null,
                eta: details.eta ?? null,
                lastSeen: details.last_seen_complete ?? null,
                peers: details.num_peers ?? null,
                peersTotal: details.total_peers ?? null,
                piecesTotal: details.num_pieces ?? null,
                seeds: details.num_seeds ?? null,
                seedsTotal: details.total_seeds ?? null,
                totalSize: details.total_wanted ?? null,
                uploadSpeed: details.upload_payload_rate ?? null,
                trackerHost: details.tracker_host ?? null,
                distributedCopies: details.distributed_copies ?? null,
                owner: details.owner ?? null,
                superSeeding: details.super_seeding ?? null,
                seedRank: details.seed_rank ?? null,
                message: details.message ?? null,
                timeSinceTransfer: details.time_since_transfer ?? null,
            },
            files: files.map((file: any, index: number) => {
                const priority = filePriorities[index] != null ? Number(filePriorities[index]) : undefined
                const progressValue = typeof fileProgress[index] === "number"
                    ? fileProgress[index]
                    : (Number(fileProgress[index]) || 0)

                return {
                    index: file.index != null ? Number(file.index) : index,
                    path: file.path || "",
                    name: (file.path || "").split(/[/\\]/).pop() || "",
                    size: typeof file.size === "number" ? file.size : (parseInt(String(file.size), 10) || 0),
                    progress: Math.max(0, Math.min(1, progressValue)),
                    priority,
                    wanted: priority !== 0,
                }
            }),
        }
    }

    async addTorrentUrl(uri: string, options?: Record<string, any>): Promise<void> {
        const uploadOptions = this.getUploadOptions(options)

        if (this.isMagnetUrl(uri)) {
            const magnetOptions = await this.resolveMagnetConfig(uploadOptions)
            const hash = parseTorrent(uri).infoHash
            await defer((done) => this.addUploadedTorrent(uri, magnetOptions, done))
            await this.applyUploadedTorrentLabel(hash, magnetOptions.label)
            return
        }

        const uploadPath = await defer<string>((done) => this.rpc("web.download_torrent_from_url", [uri, ""], done))
        const torrentInfo = await defer<Record<string, any>>((done) => this.rpc("web.get_torrent_info", [uploadPath], done))
        await defer((done) => this.addUploadedTorrent(uploadPath, uploadOptions, done))
        await this.applyUploadedTorrentLabel(torrentInfo?.info_hash, uploadOptions.label)
    }

    async uploadTorrent(buffer: Uint8Array, _filename: string, options?: Record<string, any>): Promise<void> {
        const uploadResponse = await defer<any>((done) => this.uploadTorrentPayload(buffer, done))
        const uploadPath = uploadResponse?.files?.[0]

        if (!uploadPath) {
            throw new Error("Deluge upload did not return a torrent path")
        }

        const uploadOptions = this.getUploadOptions(options)
        const hash = parseTorrent(Buffer.from(buffer)).infoHash
        await defer((done) => this.addUploadedTorrent(uploadPath, uploadOptions, done))
        await this.applyUploadedTorrentLabel(hash, uploadOptions.label)
    }

    resume(hashes: string[]): Promise<void> {
        return defer((done) => this.rpc("core.resume_torrent", [hashes], done))
    }

    pause(hashes: string[]): Promise<void> {
        return defer((done) => this.rpc("core.pause_torrent", [hashes], done))
    }

    verify(hashes: string[]): Promise<void> {
        return defer((done) => this.rpc("core.force_recheck", [hashes], done))
    }

    remove(hashes: string[]): Promise<void> {
        return Promise.all(hashes.map((hash) => defer((done) => this.rpc("core.remove_torrent", [hash, false], done)))).then(() => undefined)
    }

    removeAndDelete(hashes: string[]): Promise<void> {
        return Promise.all(hashes.map((hash) => defer((done) => this.rpc("core.remove_torrent", [hash, true], done)))).then(() => undefined)
    }

    queueUp(hashes: string[]): Promise<void> {
        return defer((done) => this.rpc("core.queue_up", [hashes], done))
    }

    queueDown(hashes: string[]): Promise<void> {
        return defer((done) => this.rpc("core.queue_down", [hashes], done))
    }

    queueTop(hashes: string[]): Promise<void> {
        return defer((done) => this.rpc("core.queue_top", [hashes], done))
    }

    queueBottom(hashes: string[]): Promise<void> {
        return defer((done) => this.rpc("core.queue_bottom", [hashes], done))
    }

    async setLabel(hashes: string[], label: string, create?: boolean): Promise<void> {
        if (!this.supportsLabels) {
            throw new Error("Deluge labels require the Label plugin to be enabled")
        }

        if (create === true) {
            await defer((done) => this.rpc("label.add", [label], done))
        }

        await Promise.all(hashes.map((hash) => defer((done) => this.rpc("label.set_torrent", [hash, label], done))))
    }

    setSpeedLimits(hashes: string[], options: Record<string, any>): Promise<void> {
        const torrentOptions: Record<string, number> = {}
        if (options.downloadSpeedLimit !== undefined) {
            torrentOptions.max_download_speed = options.downloadSpeedLimit > 0 ? Number(options.downloadSpeedLimit) : -1
        }
        if (options.uploadSpeedLimit !== undefined) {
            torrentOptions.max_upload_speed = options.uploadSpeedLimit > 0 ? Number(options.uploadSpeedLimit) : -1
        }

        return defer((done) => this.rpc("core.set_torrent_options", [hashes, torrentOptions], done)).then(() => undefined)
    }

    async setRatioLimit(hashes: string[], options: Record<string, any>): Promise<void> {
        const torrentOptions = {
            stop_at_ratio: true,
            stop_ratio: Number(options.ratioLimit),
        }

        return defer((done) => this.rpc("core.set_torrent_options", [hashes, torrentOptions], done)).then(() => undefined)
    }
}
