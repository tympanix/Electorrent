import type { BittorrentServerConfig } from "../../../../common/ipc-contract"
import { cleanPath, defer, serverUrl } from "../helpers"
import type { BittorrentRuntime } from "../types"

const Deluge = require("@electorrent/node-deluge")

export class DelugeRuntime implements BittorrentRuntime {
    private deluge: any

    async connect(server: BittorrentServerConfig): Promise<void> {
        this.deluge = new Deluge({
            host: serverUrl(server),
            port: server.port,
            path: cleanPath(server.path),
            pass: server.password,
            ca: server.certificateData,
        })

        await defer((done) => this.deluge.login(done))
        await defer((done) => this.deluge.connect(0, done))
    }

    getSnapshot(): Promise<any> {
        return defer((done) => this.deluge.getTorrents(done))
    }

    addTorrentUrl(uri: string): Promise<void> {
        return defer((done) => this.deluge.addTorrentURL(uri, {}, done))
    }

    uploadTorrent(buffer: Uint8Array): Promise<void> {
        return defer((done) => this.deluge.addTorrent(Buffer.from(buffer), {}, done))
    }

    resume(hashes: string[]): Promise<void> {
        return defer((done) => this.deluge.resume(hashes, done))
    }

    pause(hashes: string[]): Promise<void> {
        return defer((done) => this.deluge.pause(hashes, done))
    }

    verify(hashes: string[]): Promise<void> {
        return defer((done) => this.deluge.verify(hashes, done))
    }

    remove(hashes: string[]): Promise<void> {
        return defer((done) => this.deluge.remove(hashes, done))
    }

    removeAndDelete(hashes: string[]): Promise<void> {
        return defer((done) => this.deluge.removeAndDelete(hashes, done))
    }

    queueUp(hashes: string[]): Promise<void> {
        return defer((done) => this.deluge.queueUp(hashes, done))
    }

    queueDown(hashes: string[]): Promise<void> {
        return defer((done) => this.deluge.queueDown(hashes, done))
    }

    queueTop(hashes: string[]): Promise<void> {
        return defer((done) => this.deluge.queueTop(hashes, done))
    }

    queueBottom(hashes: string[]): Promise<void> {
        return defer((done) => this.deluge.queueBottom(hashes, done))
    }
}
