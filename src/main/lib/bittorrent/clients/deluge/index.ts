const request = require("request")

import type { BittorrentServerConfig } from "@shared/ipc-contract"
import { cleanPath, defer } from "@main/lib/bittorrent/helpers"
import type { BittorrentRuntime } from "@main/lib/bittorrent/types"

const DELUGE_TORRENT_FIELDS = [
    "distributed_copies",
    "download_payload_rate",
    "eta",
    "is_auto_managed",
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

function buildClientPath(server: BittorrentServerConfig, endpoint: string) {
    const prefix = cleanPath(server.path)
    const suffix = endpoint.replace(/^\/+/, "")

    return prefix ? `${prefix}/${suffix}` : `/${suffix}`
}

export class DelugeRuntime implements BittorrentRuntime {
    private requestId = 0

    private rpcUrl = ""

    private uploadUrl = ""

    private requestOptions: Record<string, any> = {}

    private getUploadOptions(options?: Record<string, any>) {
        if (!options) {
            return {}
        }

        return Object.fromEntries(
            Object.entries({
                download_location: options.saveLocation,
            }).filter(([, value]) => value !== undefined && value !== null),
        )
    }

    private rpc(method: string, params: any[], cb: (err: any, value?: any) => void) {
        request({
            ...this.requestOptions,
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
        const { timeout: _timeout, ...uploadRequestOptions } = this.requestOptions
        const uploadRequest = request({
            ...uploadRequestOptions,
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
        const options = {
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

        this.rpc("web.add_torrents", [[{ path, options }]], cb)
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

    async connect(server: BittorrentServerConfig): Promise<void> {
        const origin = `${server.proto}://${server.ip}:${server.port}`

        this.rpcUrl = `${origin}${buildClientPath(server, "json")}`
        this.uploadUrl = `${origin}${buildClientPath(server, "upload")}`
        this.requestId = 0
        this.requestOptions = {
            timeout: 5000,
            ca: server.certificateData,
            jar: request.jar(),
        }

        await defer((done) => this.rpc("auth.login", [server.password], done))

        const hosts = await this.getHosts()
        const hostId = hosts[0]?.[0]
        if (!hostId) {
            throw new Error("Deluge did not return any hosts")
        }

        await defer((done) => this.rpc("web.connect", [hostId], done))
    }

    getSnapshot(): Promise<any> {
        return defer((done) => this.rpc("web.update_ui", [DELUGE_TORRENT_FIELDS, {}], done))
    }

    async addTorrentUrl(uri: string, options?: Record<string, any>): Promise<void> {
        const uploadOptions = this.getUploadOptions(options)

        if (this.isMagnetUrl(uri)) {
            const magnetOptions = await this.resolveMagnetConfig(uploadOptions)
            await defer((done) => this.addUploadedTorrent(uri, magnetOptions, done))
            return
        }

        const uploadPath = await defer<string>((done) => this.rpc("web.download_torrent_from_url", [uri, ""], done))
        await defer((done) => this.addUploadedTorrent(uploadPath, uploadOptions, done))
    }

    async uploadTorrent(buffer: Uint8Array, _filename: string, options?: Record<string, any>): Promise<void> {
        const uploadResponse = await defer<any>((done) => this.uploadTorrentPayload(buffer, done))
        const uploadPath = uploadResponse?.files?.[0]

        if (!uploadPath) {
            throw new Error("Deluge upload did not return a torrent path")
        }

        await defer((done) => this.addUploadedTorrent(uploadPath, this.getUploadOptions(options), done))
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
}
