import Rtorrent from '@electorrent/node-rtorrent'

import type { BittorrentServerConfig } from '@shareed/ipc-contract'
import { cleanPath, defer } from '@main/lib/bittorrent/helpers'
import type { BittorrentRuntime } from '@main/lib/bittorrent/types'

export class RtorrentRuntime implements BittorrentRuntime {
    private rtorrent: any

    connect(server: BittorrentServerConfig): Promise<void> {
        this.rtorrent = new Rtorrent({
            host: server.ip,
            port: server.port,
            path: cleanPath(server.path),
            user: server.user,
            pass: server.password,
            ssl: server.proto === 'https',
            ca: server.certificateData,
        })

        return defer((done) => this.rtorrent.get('system.client_version', [], done))
    }

    getSnapshot(): Promise<any> {
        return defer((done) => this.rtorrent.getTorrentsExtra(done))
    }

    addTorrentUrl(uri: string): Promise<void> {
        return defer((done) => this.rtorrent.loadLink(uri, done))
    }

    uploadTorrent(buffer: Uint8Array): Promise<void> {
        return defer((done) => this.rtorrent.loadFileContent(Buffer.from(buffer), done))
    }

    start(hashes: string[]): Promise<void> {
        return defer((done) => this.rtorrent.start(hashes, done))
    }

    stop(hashes: string[]): Promise<void> {
        return defer((done) => this.rtorrent.stop(hashes, done))
    }

    label(hashes: string[], label: string): Promise<void> {
        return defer((done) => this.rtorrent.setLabel(hashes, label, done))
    }

    remove(hashes: string[]): Promise<void> {
        return defer((done) => this.rtorrent.remove(hashes, done))
    }

    deleteAndErase(hashes: string[]): Promise<void> {
        return defer((done) => this.rtorrent.removeAndErase(hashes, done))
    }

    recheck(hashes: string[]): Promise<void> {
        return defer((done) => this.rtorrent.recheck(hashes, done))
    }

    priorityHigh(hashes: string[]): Promise<void> {
        return defer((done) => this.rtorrent.setPriorityHigh(hashes, done))
    }

    priorityNormal(hashes: string[]): Promise<void> {
        return defer((done) => this.rtorrent.setPriorityNormal(hashes, done))
    }

    priorityLow(hashes: string[]): Promise<void> {
        return defer((done) => this.rtorrent.setPriorityLow(hashes, done))
    }

    priorityOff(hashes: string[]): Promise<void> {
        return defer((done) => this.rtorrent.setPriorityOff(hashes, done))
    }
}
