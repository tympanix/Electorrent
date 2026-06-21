import { URL } from "node:url"
import type { BittorrentServerConfig } from "@shared/ipc-contract"
import { sanitizeServerAddress } from "@shared/server-address"
import type { CallbackFunc } from "./types"

export const HTTP_LOGIN_TIMEOUT = 10_000
export const HTTP_REQUEST_TIMEOUT = 30_000

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

export function urlPath(...pathValues: Array<string | undefined>) {
    const path = pathValues
        .map((pathValue) => (pathValue || "").replace(/^\/+|\/+$/g, ""))
        .filter(Boolean)
        .join("/")

    return path ? `/${path}` : ""
}

export function serverOriginUrl(server: BittorrentServerConfig) {
    const sanitizedServer = sanitizeServerAddress(server)
    const url = new URL("http://localhost")
    url.protocol = `${sanitizedServer.proto.replace(/:$/, "")}:`
    url.host = `${sanitizedServer.ip.includes(":") && !sanitizedServer.ip.startsWith("[") ? `[${sanitizedServer.ip}]` : sanitizedServer.ip}:${sanitizedServer.port}`

    return url.origin
}

export function serverUrl(server: BittorrentServerConfig, endpoint?: string) {
    const url = new URL(serverOriginUrl(server))
    url.pathname = urlPath(server.path, endpoint) || "/"

    return url.pathname === "/" ? url.origin : url.toString()
}

export function appendUrlPath(baseUrl: string, endpoint?: string) {
    const url = new URL(baseUrl)
    url.pathname = urlPath(url.pathname, endpoint) || "/"

    return url.pathname === "/" ? url.origin : url.toString()
}

