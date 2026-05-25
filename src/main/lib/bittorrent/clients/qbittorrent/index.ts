const request = require("request")

import type { BittorrentFileSelection, BittorrentServerConfig } from "@shared/ipc-contract"
import { cleanPath, defer } from "@main/lib/bittorrent/helpers"
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
            timeout: 5000,
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
            timeout: 5000,
        }

        return hasLegacyApi ? new QBittorrentApiV1(options) : new QBittorrentApiV2(options)
    }

    private getApi() {
        if (!this.api) {
            throw new Error("qBittorrent session is not connected")
        }

        return this.api
    }

    connect(server: BittorrentServerConfig): Promise<void> {
        return this.selectApi(server).then((api) => {
            this.api = api
            return defer((done) => api.login(done))
        })
    }

    getSnapshot(fullUpdate?: boolean): Promise<any> {
        const api = this.getApi()
        let promise = Promise.resolve()

        if (fullUpdate) {
            promise = promise.then(() => defer((done) => api.reset(done)))
        }

        return promise.then(() => defer((done) => api.syncMaindata(done)))
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
