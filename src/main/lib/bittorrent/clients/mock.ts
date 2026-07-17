import type {
    BittorrentFileSelection,
    BittorrentServerConfig,
    BittorrentTorrentDetailsData,
    TorrentClientConnection,
} from "@shared/ipc-contract"
import type { BittorrentRuntime } from "@main/lib/bittorrent/types"
import type { MockTorrentFileInput, MockTorrentInput } from "@shared/bittorrent-actions"
import parseTorrent from "parse-torrent"

const PRIORITY_SKIP = 0
const PRIORITY_NORMAL = 1

interface MockTorrent {
    added_on: number
    category: string
    completion_on?: number
    dl_speed: number
    eta: number
    name: string
    num_complete: number
    num_incomplete: number
    num_leechs: number
    num_seeds: number
    priority: number
    progress: number
    ratio: number
    ratio_limit?: number
    save_path: string
    seq_dl: boolean
    size: number
    state: string
    total_downloaded: number
    total_size: number
    total_uploaded: number
    up_speed: number
}

type MockTorrentFile = MockTorrentFileInput

interface MockRuntimeStore {
    torrents: Map<string, MockTorrent>
    files: Map<string, MockTorrentFile[]>
    removedHashes: string[]
}

export class MockBittorrentRuntime implements BittorrentRuntime {
    private static stores = new Map<string, MockRuntimeStore>()

    private connected = false
    private store?: MockRuntimeStore

    async connect(server: BittorrentServerConfig): Promise<TorrentClientConnection> {
        const key = this.getServerKey(server)
        let store = MockBittorrentRuntime.stores.get(key)
        if (!store) {
            store = {
                torrents: new Map<string, MockTorrent>(),
                files: new Map<string, MockTorrentFile[]>(),
                removedHashes: [],
            }
            MockBittorrentRuntime.stores.set(key, store)
        }

        this.store = store
        this.connected = true

        return {
            version: "1.0.0",
            features: {
                magnetLinks: true,
                labels: true,
                fileSelection: true,
                uploadFileSelection: true,
                setLocation: true,
                torrentDetails: true,
                ratioLimits: true,
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

    async disconnect(): Promise<void> {
        this.connected = false
    }

    async getSnapshot(fullUpdate?: boolean): Promise<any> {
        this.assertConnected()
        const torrents = Object.fromEntries(this.torrents.entries())
        const removed = this.removedHashes.splice(0)

        return {
            categories: this.getCategories(),
            full_update: fullUpdate !== false,
            server_state: {
                free_space_on_disk: 500 * 1024 * 1024 * 1024,
            },
            torrents,
            torrents_removed: removed,
        }
    }

    async addTorrentUrl(uri: string, options?: Record<string, any>): Promise<void> {
        this.assertConnected()
        try {
            const parsed = parseTorrent(uri)
            await this.addTorrent(options?.renameTorrent || parsed.name || uri.replace(/^magnet:\?xt=urn:btih:/, "Mock Magnet "), {
                hash: parsed.infoHash,
                files: this.createFilesFromUploadSelection(options?.fileSelection),
            })
        } catch {
            await this.addTorrent(options?.renameTorrent || uri.replace(/^magnet:\?xt=urn:btih:/, "Mock Magnet "), {
                files: this.createFilesFromUploadSelection(options?.fileSelection),
            })
        }
    }

    async uploadTorrent(buffer: Uint8Array, filename: string, options?: Record<string, any>): Promise<void> {
        this.assertConnected()
        const parsed = parseTorrent(Buffer.from(buffer))
        const parsedFiles = "files" in parsed && Array.isArray(parsed.files) ? parsed.files : undefined
        await this.addTorrent(options?.renameTorrent || parsed.name || filename.replace(/\.torrent$/i, ""), {
            hash: parsed.infoHash,
            files: this.createFilesFromUploadSelection(options?.fileSelection)
                || this.createFilesFromTorrentMetadata(parsedFiles),
        })
    }

    async addMockedTorrent(_hashes: string[], input: MockTorrentInput = {}): Promise<string> {
        this.assertConnected()

        const index = this.torrents.size + 1
        const hash = input.hash || this.createHash(index)
        const progress = input.progress ?? 0
        const size = input.size ?? 1024 * 1024 * 1024
        const name = input.name || `Mock Torrent ${index.toString().padStart(3, "0")}`
        const addedOn = input.added_on ?? (1_700_000_000 + index)

        this.torrents.set(hash, {
            added_on: addedOn,
            category: input.category ?? `mock-label-${index % 5}`,
            completion_on: input.completion_on ?? (progress === 1 ? addedOn + 3600 : undefined),
            dl_speed: input.dl_speed ?? (progress === 1 ? 0 : index * 1024),
            eta: input.eta ?? (progress === 1 ? 0 : index * 60),
            name,
            num_complete: input.num_complete ?? (20 + index),
            num_incomplete: input.num_incomplete ?? (3 + (index % 7)),
            num_leechs: input.num_leechs ?? (1 + (index % 5)),
            num_seeds: input.num_seeds ?? (4 + (index % 9)),
            priority: input.priority ?? index,
            progress,
            ratio: input.ratio ?? Number((index / 10).toFixed(2)),
            ratio_limit: input.ratio_limit,
            save_path: input.save_path ?? "/mock/downloads",
            seq_dl: input.seq_dl ?? (index % 2 === 0),
            size,
            state: input.state ?? (progress === 1 ? "uploading" : "downloading"),
            total_downloaded: input.total_downloaded ?? Math.floor(size * progress),
            total_size: input.total_size ?? size,
            total_uploaded: input.total_uploaded ?? (index * 256 * 1024),
            up_speed: input.up_speed ?? (index * 256),
        })
        this.files.set(hash, input.files || this.createFiles(name, size, progress))
        return hash
    }

    async clearMockedTorrents(): Promise<void> {
        this.assertConnected()
        this.removedHashes.push(...this.torrents.keys())
        this.torrents.clear()
        this.files.clear()
    }

    async resume(hashes: string[]): Promise<void> {
        this.updateState(hashes, "downloading")
    }

    async resumeAll(): Promise<void> {
        await this.resume(Array.from(this.torrents.keys()))
    }

    async pause(hashes: string[]): Promise<void> {
        this.updateState(hashes, "pausedDL")
    }

    async pauseAll(): Promise<void> {
        await this.pause(Array.from(this.torrents.keys()))
    }

    async recheck(hashes: string[]): Promise<void> {
        void hashes
        this.assertConnected()
    }

    async increasePrio(hashes: string[]): Promise<void> {
        this.adjustPriority(hashes, -1)
    }

    async decreasePrio(hashes: string[]): Promise<void> {
        this.adjustPriority(hashes, 1)
    }

    async topPrio(hashes: string[]): Promise<void> {
        this.setPriority(hashes, 0)
    }

    async bottomPrio(hashes: string[]): Promise<void> {
        this.setPriority(hashes, this.torrents.size + 1)
    }

    async toggleSequentialDownload(hashes: string[]): Promise<void> {
        this.assertConnected()
        hashes.forEach((hash) => {
            const torrent = this.torrents.get(hash)
            if (torrent) {
                torrent.seq_dl = !torrent.seq_dl
            }
        })
    }

    async delete(hashes: string[]): Promise<void> {
        this.assertConnected()
        hashes.forEach((hash) => {
            if (this.torrents.delete(hash)) {
                this.files.delete(hash)
                this.removedHashes.push(hash)
            }
        })
    }

    async deleteAndRemove(hashes: string[]): Promise<void> {
        await this.delete(hashes)
    }

    async setCategory(hashes: string[], category: string): Promise<void> {
        this.assertConnected()
        hashes.forEach((hash) => {
            const torrent = this.torrents.get(hash)
            if (torrent) {
                torrent.category = category
            }
        })
    }

    async setLocation(hashes: string[], location: string): Promise<void> {
        this.assertConnected()
        hashes.forEach((hash) => {
            const torrent = this.torrents.get(hash)
            if (torrent) {
                torrent.save_path = location
            }
        })
    }

    async getTorrentFiles(hash: string): Promise<BittorrentFileSelection[]> {
        this.assertConnected()
        return (this.files.get(hash) || []).map((file) => ({
            index: file.index,
            path: file.name,
            name: file.name.split(/[/\\]/).pop() || "",
            size: file.size,
            wanted: file.priority !== PRIORITY_SKIP,
            priority: file.priority,
        }))
    }

    async setTorrentFileSelection(hash: string, files: BittorrentFileSelection[]): Promise<void> {
        this.assertConnected()
        const existing = this.files.get(hash)
        if (!existing) {
            return
        }

        files.forEach((selection) => {
            const file = existing.find((item) => item.index === selection.index)
            if (file) {
                file.priority = selection.wanted ? PRIORITY_NORMAL : PRIORITY_SKIP
            }
        })
    }

    async setRatioLimit(hashes: string[], options: Record<string, any>): Promise<void> {
        this.assertConnected()
        hashes.forEach((hash) => {
            const torrent = this.torrents.get(hash)
            if (torrent) {
                torrent.ratio_limit = Number(options.ratioLimit)
            }
        })
    }

    async getTorrentDetails(hash: string): Promise<BittorrentTorrentDetailsData> {
        this.assertConnected()
        const torrent = this.torrents.get(hash)
        if (!torrent) {
            throw new Error(`Mock torrent not found: ${hash}`)
        }

        return {
            info: {
                hash,
                savePath: torrent.save_path,
                creationDate: torrent.added_on - 3600,
                pieceSize: 4 * 1024 * 1024,
                comment: "Generated by the Electorrent mock bittorrent runtime",
                totalWasted: 0,
                totalUploaded: torrent.total_uploaded,
                totalDownloaded: torrent.total_downloaded,
                uploadLimit: -1,
                downloadLimit: -1,
                timeElapsed: 120,
                seedingTime: torrent.progress === 1 ? 600 : 0,
                connections: torrent.num_leechs + torrent.num_seeds,
                connectionsLimit: 100,
                shareRatio: torrent.ratio,
                ratioLimit: torrent.ratio_limit ?? null,
                additionDate: torrent.added_on,
                completionDate: torrent.completion_on ?? null,
                createdBy: "Electorrent Mock",
                downloadSpeed: torrent.dl_speed,
                eta: torrent.eta,
                peers: torrent.num_leechs,
                peersTotal: torrent.num_incomplete,
                piecesHave: Math.round(torrent.progress * 100),
                piecesTotal: 100,
                reannounce: 1800,
                seeds: torrent.num_seeds,
                seedsTotal: torrent.num_complete,
                sequentialDownload: torrent.seq_dl,
                totalSize: torrent.total_size,
                uploadSpeed: torrent.up_speed,
                isPrivate: false,
            },
            files: (this.files.get(hash) || []).map((file) => ({
                index: file.index,
                path: file.name,
                name: file.name.split(/[/\\]/).pop() || file.name,
                size: file.size,
                progress: file.progress,
                availability: file.availability,
                priority: file.priority,
                wanted: file.priority !== PRIORITY_SKIP,
                isSeed: file.is_seed,
            })),
        }
    }

    private createHash(index: number) {
        return index.toString(16).padStart(40, "0")
    }

    private createFiles(name: string, size: number, progress: number): MockTorrentFile[] {
        return [
            {
                index: 0,
                name: `${name}/video.mkv`,
                size: Math.floor(size * 0.9),
                progress,
                availability: 1,
                priority: PRIORITY_NORMAL,
                is_seed: progress === 1,
            },
            {
                index: 1,
                name: `${name}/notes.txt`,
                size: Math.floor(size * 0.1),
                progress,
                availability: 1,
                priority: PRIORITY_NORMAL,
                is_seed: progress === 1,
            },
        ]
    }

    private createFilesFromUploadSelection(files: unknown): MockTorrentFile[] | undefined {
        if (!Array.isArray(files) || files.length === 0) {
            return undefined
        }

        return files.map((file: BittorrentFileSelection, index: number) => ({
            index: file.index ?? index,
            name: file.path || file.name || `file-${index + 1}`,
            size: file.size || 0,
            progress: 0,
            availability: 1,
            priority: file.wanted ? PRIORITY_NORMAL : PRIORITY_SKIP,
            is_seed: false,
        }))
    }

    private createFilesFromTorrentMetadata(files: any[] | undefined): MockTorrentFile[] | undefined {
        if (!Array.isArray(files) || files.length === 0) {
            return undefined
        }

        return files.map((file, index) => ({
            index,
            name: file.path || file.name || `file-${index + 1}`,
            size: typeof file.length === "number" ? file.length : 0,
            progress: 0,
            availability: 1,
            priority: PRIORITY_NORMAL,
            is_seed: false,
        }))
    }

    private getCategories() {
        return Object.fromEntries(
            Array.from(new Set(Array.from(this.torrents.values()).map((torrent) => torrent.category)))
                .sort()
                .map((name) => [name, { name }]),
        )
    }

    private async addTorrent(name: string, input: MockTorrentInput = {}) {
        await this.addMockedTorrent([], {
            ...input,
            added_on: Math.floor(Date.now() / 1000),
            category: "mock-label-new",
            dl_speed: 512 * 1024,
            eta: 3600,
            name,
            num_complete: 10,
            num_incomplete: 5,
            num_leechs: 1,
            num_seeds: 2,
            progress: 0,
            ratio: 0,
            save_path: "/mock/downloads",
            seq_dl: false,
            size: 1024 * 1024 * 1024,
            state: "downloading",
            total_downloaded: 0,
            total_uploaded: 0,
            up_speed: 0,
        })
    }

    private updateState(hashes: string[], state: string) {
        this.assertConnected()
        hashes.forEach((hash) => {
            const torrent = this.torrents.get(hash)
            if (torrent) {
                torrent.state = state
            }
        })
    }

    private adjustPriority(hashes: string[], delta: number) {
        this.assertConnected()
        hashes.forEach((hash) => {
            const torrent = this.torrents.get(hash)
            if (torrent) {
                torrent.priority += delta
            }
        })
    }

    private setPriority(hashes: string[], priority: number) {
        this.assertConnected()
        hashes.forEach((hash) => {
            const torrent = this.torrents.get(hash)
            if (torrent) {
                torrent.priority = priority
            }
        })
    }

    private assertConnected() {
        if (!this.connected || !this.store) {
            throw new Error("Mock bittorrent session is not connected")
        }
    }

    private get torrents() {
        this.assertConnected()
        return this.store!.torrents
    }

    private get files() {
        this.assertConnected()
        return this.store!.files
    }

    private get removedHashes() {
        this.assertConnected()
        return this.store!.removedHashes
    }

    private getServerKey(server: BittorrentServerConfig) {
        return server.id || `${server.client}:${server.proto}://${server.ip}:${server.port}${server.path || ""}`
    }
}
