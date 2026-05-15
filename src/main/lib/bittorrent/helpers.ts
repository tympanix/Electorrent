import https from "https"
import type { BittorrentServerConfig } from "@shareed/ipc-contract"
import type { CallbackFunc } from "./types"

export function defer<T>(fn: (f: CallbackFunc<T>) => void): Promise<T> {
    return new Promise((resolve, reject) => {
        fn((err, val) => {
            if (err) {
                reject(err)
            } else {
                resolve(val)
            }
        })
    })
}

export function cleanPath(pathValue?: string) {
    const raw = pathValue || ""
    const trimmed = raw.replace(/^\/+|\/+$/g, "")
    return trimmed ? `/${trimmed}` : ""
}

export function serverUrl(server: BittorrentServerConfig) {
    return `${server.proto}://${server.ip}:${server.port}${cleanPath(server.path)}`
}

export function createHttpsAgent(server: BittorrentServerConfig) {
    return new https.Agent({
        ca: server.certificateData ? Buffer.from(server.certificateData) : undefined,
    })
}
