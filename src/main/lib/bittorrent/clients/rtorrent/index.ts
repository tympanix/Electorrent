const xmlrpc = require("@electorrent/xmlrpc")

import type { BittorrentServerConfig } from "@shared/ipc-contract"
import { cleanPath, defer } from "@main/lib/bittorrent/helpers"
import type { BittorrentRuntime } from "@main/lib/bittorrent/types"
import { doubleArrayToHash, postfix, rtorrentFields, stringsToBooleans, stringsToNumbers, urlHostname } from "./helpers"

type RtorrentMethodCall = {
    methodName: string
    params: any[]
}

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
