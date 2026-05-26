import path from "path"

const request = require("request")

export const AUTH_ERRORS: Record<number, Error> = {
    403: new Error("User's IP is banned for too many failed login attempts"),
}

export const TORRENT_ERRORS: Record<number, Error> = {
    404: new Error("Torrent hash was not found"),
}

export type QBittorrentApiOptions = {
    origin: string
    path: string
    user: string
    pass: string
    ca?: Uint8Array
    timeout?: number
}

export abstract class QBittorrentBaseApi {
    protected readonly basePath: string

    protected readonly user: string

    protected readonly pass: string

    protected readonly origin: string

    protected readonly timeout: number

    public rid = 0

    protected readonly options: Record<string, any>

    constructor(options: QBittorrentApiOptions) {
        this.basePath = options.path
        this.user = options.user
        this.pass = options.pass
        this.origin = options.origin
        this.timeout = options.timeout || 5000

        this.options = {
            timeout: this.timeout,
            ca: options.ca,
            jar: request.jar(),
            headers: {
                Referer: this.origin,
            },
        }
    }

    protected abstract buildPath(name: string): string

    protected handleError(cb: (err: any, body?: any) => void, errors?: Record<number, Error>) {
        return (err: any, res: any, body: any) => {
            if (err) {
                cb(err, body)
                return
            }

            if (errors && res && Object.prototype.hasOwnProperty.call(errors, res.statusCode)) {
                cb(errors[res.statusCode], body)
                return
            }

            if (body === "Fails.") {
                cb(new Error("Request failed"))
                return
            }

            cb(null, body)
        }
    }

    protected url(name: string) {
        return `${this.origin}${this.buildPath(name)}`
    }

    protected http(method: string, apiPath: string, requestOptions: Record<string, any>, cb: (err: any, res?: any, body?: any) => void) {
        request({
            ...this.options,
            method,
            uri: this.url(apiPath),
            ...requestOptions,
        }, (err: any, res: any, body: any) => {
            if (err) {
                cb(err, res, body)
                return
            }

            if (!res || !this.isSuccessfulStatusCode(res.statusCode)) {
                cb(new Error(res?.statusCode || "Unknown HTTP error"), res, body)
                return
            }

            cb(null, res, body)
        })
    }

    protected isSuccessfulStatusCode(statusCode: number) {
        return statusCode >= 200 && statusCode < 300
    }

    get(apiPath: string, requestOptions: Record<string, any>, cb: (err: any, res?: any, body?: any) => void) {
        this.http("GET", apiPath, requestOptions, cb)
    }

    getJson(apiPath: string, requestOptions: Record<string, any>, cb: (err: any, res?: any, body?: any) => void) {
        this.get(apiPath, { json: true, ...requestOptions }, cb)
    }

    post(apiPath: string, requestOptions: Record<string, any>, cb: (err: any, res?: any, body?: any) => void) {
        this.http("POST", apiPath, requestOptions, cb)
    }

    reset(cb: (err?: any) => void) {
        this.rid = 0
        cb()
    }

    addTorrentFile(filepath: string, options: Record<string, any> | undefined, cb: (err?: any, body?: any) => void) {
        const data = require("fs").readFileSync(filepath)
        this.addTorrentFileContent(data, path.basename(filepath), options, cb)
    }

    abstract login(cb: (err?: any, body?: any) => void): void

    abstract syncMaindata(cb: (err?: any, body?: any) => void): void

    abstract addTorrentFileContent(content: Buffer | Uint8Array, filename: string, options: Record<string, any> | undefined, cb: (err?: any, body?: any) => void): void

    abstract addTorrentURL(magneturl: string, options: Record<string, any> | undefined, cb: (err?: any, body?: any) => void): void

    abstract pause(hashes: string[] | string, cb: (err?: any, body?: any) => void): void

    abstract pauseAll(cb: (err?: any, body?: any) => void): void

    abstract resume(hashes: string[] | string, cb: (err?: any, body?: any) => void): void

    abstract resumeAll(cb: (err?: any, body?: any) => void): void

    abstract delete(hashes: string[], cb: (err?: any, body?: any) => void): void

    abstract deleteAndRemove(hashes: string[], cb: (err?: any, body?: any) => void): void

    abstract recheck(hashes: string[], cb: (err?: any, body?: any) => void): void

    abstract increasePrio(hashes: string[], cb: (err?: any, body?: any) => void): void

    abstract decreasePrio(hashes: string[], cb: (err?: any, body?: any) => void): void

    abstract topPrio(hashes: string[], cb: (err?: any, body?: any) => void): void

    abstract bottomPrio(hashes: string[], cb: (err?: any, body?: any) => void): void

    abstract setCategory(hashes: string[], category: string, cb: (err?: any, body?: any) => void): void

    abstract setLocation(hashes: string[], location: string, cb: (err?: any, body?: any) => void): void

    abstract createCategory(category: string, savePath: string, cb: (err?: any, body?: any) => void): void

    abstract toggleSequentialDownload(hashes: string[], cb: (err?: any, body?: any) => void): void
}
