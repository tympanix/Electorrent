import { URL } from "node:url"
import type { BittorrentServerConfig } from "@shared/ipc-contract"
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
    const url = new URL("http://localhost")
    url.protocol = `${server.proto.replace(/:$/, "")}:`
    url.host = `${server.ip.includes(":") && !server.ip.startsWith("[") ? `[${server.ip}]` : server.ip}:${server.port}`

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

