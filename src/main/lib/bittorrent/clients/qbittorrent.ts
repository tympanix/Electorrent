import QBittorrent from '@electorrent/node-qbittorrent'

import type { BittorrentFileSelection, BittorrentServerConfig } from '../../../../shared/ipc-contract'
import { cleanPath, defer, serverUrl } from '../helpers'
import type { BittorrentRuntime } from '../types'

const QBITTORRENT_PRIORITY_SKIP = 0
const QBITTORRENT_PRIORITY_NORMAL = 1

export class QBittorrentRuntime implements BittorrentRuntime {
    private qbittorrent: any

    connect(server: BittorrentServerConfig): Promise<void> {
        this.qbittorrent = new QBittorrent({
            host: serverUrl(server),
            port: server.port,
            path: cleanPath(server.path),
            user: server.user,
            pass: server.password,
            ca: server.certificateData,
        })

        return defer((done) => this.qbittorrent.login(done))
    }

    getSnapshot(fullUpdate?: boolean): Promise<any> {
        let promise = Promise.resolve()
        if (fullUpdate) {
            promise = promise.then(() => defer((done) => this.qbittorrent.reset(done)))
        }

        return promise.then(() => defer((done) => this.qbittorrent.syncMaindata(done)))
    }

    private getHttpUploadOptions(options?: Record<string, any>) {
        if (!options) {
            return undefined
        }

        const qbittorrentOptions: Record<string, any> = {
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
        }

        return Object.fromEntries(
            Object.entries(qbittorrentOptions)
                .filter(([, value]) => value !== undefined && value !== null)
                .map(([key, value]) => [key, value.toString()]),
        )
    }

    addTorrentUrl(uri: string, options?: Record<string, any>): Promise<void> {
        return defer((done) => this.qbittorrent.addTorrentURL(uri, this.getHttpUploadOptions(options), done))
    }

    uploadTorrent(buffer: Uint8Array, filename: string, options?: Record<string, any>): Promise<void> {
        return defer((done) => this.qbittorrent.addTorrentFileContent(Buffer.from(buffer), filename, this.getHttpUploadOptions(options), done))
    }

    resume(hashes: string[]): Promise<void> {
        return defer((done) => this.qbittorrent.resume(hashes, done))
    }

    resumeAll(): Promise<void> {
        return defer((done) => this.qbittorrent.resumeAll(done))
    }

    pause(hashes: string[]): Promise<void> {
        return defer((done) => this.qbittorrent.pause(hashes, done))
    }

    pauseAll(): Promise<void> {
        return defer((done) => this.qbittorrent.pauseAll(done))
    }

    recheck(hashes: string[]): Promise<void> {
        return defer((done) => this.qbittorrent.recheck(hashes, done))
    }

    increasePrio(hashes: string[]): Promise<void> {
        return defer((done) => this.qbittorrent.increasePrio(hashes, done))
    }

    decreasePrio(hashes: string[]): Promise<void> {
        return defer((done) => this.qbittorrent.decreasePrio(hashes, done))
    }

    topPrio(hashes: string[]): Promise<void> {
        return defer((done) => this.qbittorrent.topPrio(hashes, done))
    }

    bottomPrio(hashes: string[]): Promise<void> {
        return defer((done) => this.qbittorrent.bottomPrio(hashes, done))
    }

    toggleSequentialDownload(hashes: string[]): Promise<void> {
        return defer((done) => this.qbittorrent.toggleSequentialDownload(hashes, done))
    }

    delete(hashes: string[]): Promise<void> {
        return defer((done) => this.qbittorrent.delete(hashes, done))
    }

    deleteAndRemove(hashes: string[]): Promise<void> {
        return defer((done) => this.qbittorrent.deleteAndRemove(hashes, done))
    }

    async setCategory(hashes: string[], category: string, create?: boolean): Promise<void> {
        if (create === true) {
            await defer((done) => this.qbittorrent.createCategory(category, '', done))
        }
        await defer((done) => this.qbittorrent.setCategory(hashes, category, done))
    }

    getTorrentFiles(hash: string): Promise<any> {
        const api = this.qbittorrent?.api
        if (!api || typeof api.getJson !== 'function') {
            return Promise.reject(new Error('qBittorrent API does not support getTorrentFiles'))
        }

        return new Promise((resolve, reject) => {
            api.getJson('torrents/files', { qs: { hash } }, (err: any, _res: any, body: any) => {
                if (err) {
                    reject(err)
                    return
                }
                resolve(body)
            })
        })
    }

    async setTorrentFileSelection(hash: string, files: BittorrentFileSelection[]): Promise<void> {
        const api = this.qbittorrent?.api
        if (!api || typeof api.post !== 'function') {
            throw new Error('qBittorrent API does not support setTorrentFileSelection')
        }

        const wantedIds = files.filter((file) => file.wanted).map((file) => file.index)
        const unwantedIds = files.filter((file) => !file.wanted).map((file) => file.index)

        const setPriority = (ids: number[], priority: number) => new Promise<void>((resolve, reject) => {
            if (ids.length === 0) {
                resolve()
                return
            }

            api.post('torrents/filePrio', {
                form: {
                    hash,
                    id: ids.join('|'),
                    priority: String(priority),
                },
            }, (err: any) => {
                if (err) {
                    reject(err)
                } else {
                    resolve()
                }
            })
        })

        await setPriority(unwantedIds, QBITTORRENT_PRIORITY_SKIP)
        await setPriority(wantedIds, QBITTORRENT_PRIORITY_NORMAL)
    }
}
