const xmlrpc = require("@electorrent/xmlrpc")

import type { BittorrentServerConfig, BittorrentTorrentDetailsData } from "@shared/ipc-contract"
import { cleanPath, defer } from "@main/lib/bittorrent/helpers"
import type { BittorrentRuntime } from "@main/lib/bittorrent/types"
import { doubleArrayToHash, postfix, rtorrentFields, stringsToBooleans, stringsToNumbers, urlHostname } from "./helpers"

type RtorrentMethodCall = {
    methodName: string
    params: any[]
}

type RtorrentMulticallCommand = string | [string, ...any[]]

export class RtorrentRuntime implements BittorrentRuntime {
    private client: any

    private async call<T = any>(method: string, params: any[]): Promise<T> {
        return defer<T>((done) => this.client.methodCall(method, params, done))
    }

    private async ensureSaveLocation(saveLocation?: string) {
        if (!saveLocation) {
            return
        }

        await this.call("execute.throw", ["", "mkdir", "-p", saveLocation])
    }

    private async loadTorrentWithSaveLocation(method: string, torrent: Uint8Array | string, saveLocation: string) {
        const params: (string | Buffer)[] = [
            "",
            typeof torrent === "string" ? torrent : Buffer.from(torrent),
        ]

        await this.ensureSaveLocation(saveLocation)
        params.push(`d.directory.set=${JSON.stringify(saveLocation)}`)

        await this.call(method, params)
    }

    private async getMulticall(method: string, params: any[], commands: Record<string, string>): Promise<Record<string, any>[]> {
        const commandParams = [...params, ...Object.values(commands).map(postfix)]
        const data = await this.call<any[][]>(method, commandParams)

        return doubleArrayToHash(data, Object.keys(commands))
    }

    private unwrapMulticallResult<T = any>(result: any): T {
        return (Array.isArray(result) ? result[0] : result) as T
    }

    private async getTorrentFields(hash: string, commands: Record<string, RtorrentMulticallCommand>): Promise<Record<string, any>> {
        const entries = Object.entries(commands)
        const calls: RtorrentMethodCall[] = entries.map(([, command]) => {
            const [methodName, ...extraParams] = Array.isArray(command) ? command : [command]
            return {
                methodName,
                params: [hash, ...extraParams],
            }
        })
        const results = await this.call<any[]>("system.multicall", [calls])

        return Object.fromEntries(entries.map(([key], index) => [key, this.unwrapMulticallResult(results[index])]))
    }

    private async getMulticallHashes(hashes: string[], commands: string[], params: any[]) {
        const calls: RtorrentMethodCall[] = []

        for (const hash of hashes) {
            for (const [index, command] of commands.entries()) {
                const param = params[index]
                calls.push({
                    methodName: command,
                    params: [hash, ...(param === undefined ? [] : [param])],
                })
            }
        }

        return this.call("system.multicall", [calls])
    }

    private async setTorrentHashes(hashes: string[], commands: string[], params: any[]) {
        await this.getMulticallHashes(hashes, commands, params)
    }

    connect(server: BittorrentServerConfig): Promise<void> {
        const options: Record<string, any> = {
            host: server.ip,
            port: server.port,
            path: cleanPath(server.path) || "/RPC2",
            headers: {
                "User-Agent": "NodeJS XML-RPC Client",
                "Content-Type": "text/xml",
                Accept: "text/xml",
                "Accept-Charset": "UTF8",
                Connection: "Close",
            },
            ca: server.certificateData,
            timeout: 5000,
        }

        if (server.user && server.password) {
            options.username = server.user
            options.password = server.password
        }

        this.client = server.proto === "https" ? xmlrpc.createSecureClient(options) : xmlrpc.createClient(options)

        return this.call("system.client_version", []).then(() => undefined)
    }

    async getSnapshot(): Promise<any> {
        const torrents = await this.getMulticall("d.multicall2", ["", "main"], rtorrentFields.torrents)

        for (const torrent of torrents) {
            stringsToBooleans(torrent, ["active", "open", "complete", "hashing", "hashed"])
            stringsToNumbers(torrent)
            torrent.label = decodeURIComponent(torrent.label || "")

            if (torrent.down_total < torrent.completed) {
                torrent.down_total = torrent.completed
            }

            torrent.ratio = torrent.up_total / torrent.down_total
        }

        const trackerCalls = torrents.map((torrent) => ({
            methodName: "t.multicall",
            params: [torrent.hash, "", ...Object.values(rtorrentFields.trackers).map(postfix)],
        }))
        const trackerResults = await this.call<any[][][]>("system.multicall", [trackerCalls])

        torrents.forEach((torrent, index) => {
            const trackerData = doubleArrayToHash(trackerResults[index][0], Object.keys(rtorrentFields.trackers))

            trackerData.forEach((tracker: Record<string, any>) => {
                stringsToBooleans(tracker, ["enabled", "open"])
                stringsToNumbers(tracker)
            })

            torrent.trackerdata = trackerData
            torrent.trackers = trackerData.map((tracker: Record<string, any>) => tracker.url)
            torrent.tracker = trackerData[0] && urlHostname(trackerData[0].url)
            torrent.leechers_total = trackerData.reduce((sum: number, tracker: Record<string, any>) => sum + tracker.scrape_incomplete, 0)
            torrent.seeders_total = trackerData.reduce((sum: number, tracker: Record<string, any>) => sum + tracker.scrape_complete, 0)
        })

        const labelSet = new Set<string>()
        const trackerSet = new Set<string>()

        torrents.forEach((torrent) => {
            if (torrent.label) {
                labelSet.add(torrent.label)
            }

            if (torrent.tracker) {
                trackerSet.add(torrent.tracker)
            }
        })

        const labels = [...labelSet]
        const trackers = [...trackerSet]

        return {
            torrents,
            labels,
            trackers,
        }
    }

    async getTorrentDetails(hash: string): Promise<BittorrentTorrentDetailsData> {
        const detailCommands: Record<string, RtorrentMulticallCommand> = {
            savePath: "d.directory",
            name: "d.name",
            totalSize: "d.size_bytes",
            creationDate: "d.creation_date",
            pieceSize: "d.chunk_size",
            totalDownloaded: "d.down.total",
            totalUploaded: "d.up.total",
            downloadSpeed: "d.down.rate",
            uploadSpeed: "d.up.rate",
            leftBytes: "d.left_bytes",
            label: "d.custom1",
            chunksComplete: "d.completed_chunks",
            message: "d.message",
            peers: "d.peers_accounted",
            seeds: "d.peers_complete",
            additionDate: ["d.custom", "addtime"],
        }
        const numericDetailFields = [
            "totalSize",
            "creationDate",
            "pieceSize",
            "totalDownloaded",
            "totalUploaded",
            "downloadSpeed",
            "uploadSpeed",
            "leftBytes",
            "chunksComplete",
            "peers",
            "seeds",
            "additionDate",
        ] as const
        const fileCommands = {
            path: "f.path",
            size: "f.size_bytes",
            completedChunks: "f.completed_chunks",
            totalChunks: "f.size_chunks",
            priority: "f.priority",
        }

        const [detailFields, files] = await Promise.all([
            this.getTorrentFields(hash, detailCommands),
            this.getMulticall("f.multicall", [hash, ""], fileCommands),
        ])

        numericDetailFields.forEach((field) => {
            const numeric = Number(detailFields[field])
            detailFields[field] = Number.isFinite(numeric) ? numeric : null
        })
        files.forEach((file) => stringsToNumbers(file))

        const savePath = typeof detailFields.savePath === "string" ? detailFields.savePath : null
        const name = typeof detailFields.name === "string" ? detailFields.name : null
        const totalSize = typeof detailFields.totalSize === "number" ? detailFields.totalSize : null
        const creationDate = typeof detailFields.creationDate === "number" ? detailFields.creationDate : null
        const pieceSize = typeof detailFields.pieceSize === "number" ? detailFields.pieceSize : null
        const totalDownloaded = typeof detailFields.totalDownloaded === "number" ? detailFields.totalDownloaded : null
        const totalUploaded = typeof detailFields.totalUploaded === "number" ? detailFields.totalUploaded : null
        const downloadSpeed = typeof detailFields.downloadSpeed === "number" ? detailFields.downloadSpeed : null
        const uploadSpeed = typeof detailFields.uploadSpeed === "number" ? detailFields.uploadSpeed : null
        const leftBytes = typeof detailFields.leftBytes === "number" ? detailFields.leftBytes : null
        const label = typeof detailFields.label === "string" ? detailFields.label : null
        const chunksComplete = typeof detailFields.chunksComplete === "number" ? detailFields.chunksComplete : null
        const message = typeof detailFields.message === "string" ? detailFields.message : null
        const peers = typeof detailFields.peers === "number" ? detailFields.peers : null
        const seeds = typeof detailFields.seeds === "number" ? detailFields.seeds : null
        const additionDate = typeof detailFields.additionDate === "number" ? detailFields.additionDate : null
        const ratio = totalDownloaded > 0 ? totalUploaded / totalDownloaded : null

        return {
            info: {
                hash,
                name: name ?? null,
                savePath: savePath ?? null,
                creationDate: creationDate ?? null,
                pieceSize: pieceSize ?? null,
                totalDownloaded: totalDownloaded ?? null,
                totalUploaded: totalUploaded ?? null,
                shareRatio: ratio,
                additionDate: additionDate ?? null,
                downloadSpeed: downloadSpeed ?? null,
                eta: downloadSpeed > 0 ? (leftBytes ?? 0) / downloadSpeed : null,
                peers: peers ?? null,
                seeds: seeds ?? null,
                totalSize: totalSize ?? null,
                uploadSpeed: uploadSpeed ?? null,
                label: typeof label === "string" ? decodeURIComponent(label) : null,
                chunksComplete: chunksComplete ?? null,
                message: message ?? null,
            },
            files: files.map((file: Record<string, any>, index: number) => {
                const size = typeof file.size === "number" ? file.size : 0
                const totalChunks = typeof file.totalChunks === "number" ? file.totalChunks : 0
                const completedChunks = typeof file.completedChunks === "number" ? file.completedChunks : 0
                const priority = file.priority != null ? Number(file.priority) : undefined

                return {
                    index,
                    path: file.path || "",
                    name: (file.path || "").split(/[/\\]/).pop() || "",
                    size,
                    progress: totalChunks > 0 ? Math.max(0, Math.min(1, completedChunks / totalChunks)) : 0,
                    priority,
                    wanted: priority !== 0,
                }
            }),
        }
    }

    async addTorrentUrl(uri: string, options?: Record<string, any>): Promise<void> {
        if (options?.saveLocation) {
            await this.loadTorrentWithSaveLocation("load.start", uri, options.saveLocation)
            return
        }

        await this.call("load.start", ["", uri])
    }

    async uploadTorrent(buffer: Uint8Array, _filename: string, options?: Record<string, any>): Promise<void> {
        if (options?.saveLocation) {
            await this.loadTorrentWithSaveLocation("load.raw_start", buffer, options.saveLocation)
            return
        }

        await this.call("load.raw_start", ["", Buffer.from(buffer)])
    }

    async start(hashes: string[]): Promise<void> {
        await this.setTorrentHashes(hashes, ["d.open"], [])
        await this.setTorrentHashes(hashes, ["d.start"], [])
    }

    async stop(hashes: string[]): Promise<void> {
        await this.setTorrentHashes(hashes, ["d.stop"], [])
        await this.setTorrentHashes(hashes, ["d.close"], [])
    }

    label(hashes: string[], label: string): Promise<void> {
        return this.setTorrentHashes(hashes, ["d.custom1.set"], [label])
    }

    remove(hashes: string[]): Promise<void> {
        return this.setTorrentHashes(hashes, ["d.erase"], [])
    }

    deleteAndErase(hashes: string[]): Promise<void> {
        return this.setTorrentHashes(hashes, ["d.custom5.set", "d.delete_tied", "d.erase"], ["1"])
    }

    recheck(hashes: string[]): Promise<void> {
        return this.setTorrentHashes(hashes, ["d.check_hash"], [])
    }

    priorityHigh(hashes: string[]): Promise<void> {
        return this.setTorrentHashes(hashes, ["d.priority.set"], [3])
    }

    priorityNormal(hashes: string[]): Promise<void> {
        return this.setTorrentHashes(hashes, ["d.priority.set"], [2])
    }

    priorityLow(hashes: string[]): Promise<void> {
        return this.setTorrentHashes(hashes, ["d.priority.set"], [1])
    }

    priorityOff(hashes: string[]): Promise<void> {
        return this.setTorrentHashes(hashes, ["d.priority.set"], [0])
    }
}
