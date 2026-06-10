import type {
    BittorrentFileSelection,
    BittorrentServerConfig,
    BittorrentTorrentDetailsData,
    TorrentClientFeatures,
} from "@shared/ipc-contract"
import type { BittorrentRuntime } from "@main/lib/bittorrent/types"

const DEFAULT_TORRENT_COUNT = 100
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
    save_path: string
    seq_dl: boolean
    size: number
    state: string
    total_downloaded: number
    total_size: number
    total_uploaded: number
    up_speed: number
}

interface MockTorrentFile {
    index: number
    name: string
    size: number
    progress: number
    availability: number
    priority: number
    is_seed: boolean
}

export class MockBittorrentRuntime implements BittorrentRuntime {
    private connected = false
    private torrents = new Map<string, MockTorrent>()
    private files = new Map<string, MockTorrentFile[]>()
    private removedHashes: string[] = []

    async connect(server: BittorrentServerConfig): Promise<TorrentClientFeatures> {
        const count = this.getTorrentCount(server)
        this.torrents.clear()
        this.files.clear()
        this.removedHashes = []

        for (let index = 1; index <= count; index += 1) {
            const hash = this.createHash(index)
            const size = (512 + index) * 1024 * 1024
            const progress = index % 4 === 0 ? 1 : Number((index / (count + 1)).toFixed(4))
            const state = progress === 1 ? "uploading" : (index % 3 === 0 ? "stalledDL" : "downloading")

            this.torrents.set(hash, {
                added_on: 1_700_000_000 + index,
                category: `mock-label-${index % 5}`,
                completion_on: progress === 1 ? 1_700_100_000 + index : undefined,
                dl_speed: progress === 1 ? 0 : index * 1024,
                eta: progress === 1 ? 0 : (count - index + 1) * 60,
                name: `Mock Torrent ${index.toString().padStart(3, "0")}`,
                num_complete: 20 + index,
                num_incomplete: 3 + (index % 7),
                num_leechs: 1 + (index % 5),
                num_seeds: 4 + (index % 9),
                priority: index,
                progress,
                ratio: Number((index / 10).toFixed(2)),
                save_path: "/mock/downloads",
                seq_dl: index % 2 === 0,
                size,
                state,
                total_downloaded: Math.floor(size * progress),
                total_size: size,
                total_uploaded: index * 256 * 1024,
                up_speed: index * 256,
            })
            this.files.set(hash, this.createFiles(index, size, progress))
        }

        this.connected = true

        return {
            magnetLinks: true,
            labels: true,
            fileSelection: true,
            setLocation: true,
            torrentDetails: true,
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
        this.addTorrent(options?.renameTorrent || uri.replace(/^magnet:\?xt=urn:btih:/, "Mock Magnet "))
    }

    async uploadTorrent(_buffer: Uint8Array, filename: string, options?: Record<string, any>): Promise<void> {
        this.assertConnected()
        this.addTorrent(options?.renameTorrent || filename.replace(/\.torrent$/i, ""))
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

    async getTorrentFiles(hash: string): Promise<MockTorrentFile[]> {
        this.assertConnected()
        return this.files.get(hash) || []
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

    private getTorrentCount(server: BittorrentServerConfig) {
        const parsedCount = Number(server.path?.match(/torrentCount=(\d+)/)?.[1])
        return Number.isInteger(parsedCount) && parsedCount > 0 ? parsedCount : DEFAULT_TORRENT_COUNT
    }

    private createHash(index: number) {
        return index.toString(16).padStart(40, "0")
    }

    private createFiles(index: number, size: number, progress: number): MockTorrentFile[] {
        return [
            {
                index: 0,
                name: `Mock Torrent ${index.toString().padStart(3, "0")}/video.mkv`,
                size: Math.floor(size * 0.9),
                progress,
                availability: 1,
                priority: PRIORITY_NORMAL,
                is_seed: progress === 1,
            },
            {
                index: 1,
                name: `Mock Torrent ${index.toString().padStart(3, "0")}/notes.txt`,
                size: Math.floor(size * 0.1),
                progress,
                availability: 1,
                priority: PRIORITY_NORMAL,
                is_seed: progress === 1,
            },
        ]
    }

    private getCategories() {
        return Object.fromEntries(
            Array.from(new Set(Array.from(this.torrents.values()).map((torrent) => torrent.category)))
                .sort()
                .map((name) => [name, { name }]),
        )
    }

    private addTorrent(name: string) {
        const index = this.torrents.size + 1
        const hash = this.createHash(index)
        const size = 1024 * 1024 * 1024
        this.torrents.set(hash, {
            added_on: Math.floor(Date.now() / 1000),
            category: "mock-label-new",
            dl_speed: 512 * 1024,
            eta: 3600,
            name,
            num_complete: 10,
            num_incomplete: 5,
            num_leechs: 1,
            num_seeds: 2,
            priority: index,
            progress: 0,
            ratio: 0,
            save_path: "/mock/downloads",
            seq_dl: false,
            size,
            state: "downloading",
            total_downloaded: 0,
            total_size: size,
            total_uploaded: 0,
            up_speed: 0,
        })
        this.files.set(hash, this.createFiles(index, size, 0))
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
        if (!this.connected) {
            throw new Error("Mock bittorrent session is not connected")
        }
    }
}
