import { AUTH_ERRORS, QBittorrentBaseApi, TORRENT_ERRORS } from "./base-api"

export class QBittorrentApiV2 extends QBittorrentBaseApi {
    private useStartStopEndpoints = false

    protected buildPath(name: string) {
        const suffix = name.replace(/^\/+/, "")
        const prefix = this.basePath ? `${this.basePath}/api/v2` : "/api/v2"
        return `${prefix}/${suffix}`
    }

    login(cb: (err?: any, body?: any) => void) {
        this.post("auth/login", {
            form: {
                username: this.user,
                password: this.pass,
            },
        }, (err, res, body) => {
            if (!err && res && !Object.prototype.hasOwnProperty.call(res.headers || {}, "set-cookie")) {
                cb(new Error("Invalid login"), body)
                return
            }

            this.get("app/version", {}, (versionErr, _versionRes, versionBody) => {
                if (!versionErr && typeof versionBody === "string") {
                    const majorVersion = Number(versionBody.replace(/^v/, "").split(".")[0])
                    this.useStartStopEndpoints = majorVersion >= 5
                }

                this.handleError(cb, AUTH_ERRORS)(err, res, body)
            })
        })
    }

    syncMaindata(cb: (err?: any, body?: any) => void) {
        this.getJson("sync/maindata", { qs: { rid: this.rid } }, (err, res, body) => {
            if (!err) {
                this.rid = body?.rid || 0
            }
            this.handleError(cb)(err, res, body)
        })
    }

    addTorrentFileContent(content: Buffer | Uint8Array, filename: string, options: Record<string, any> | undefined, cb: (err?: any, body?: any) => void) {
        const formData = {
            torrents: {
                value: Buffer.isBuffer(content) ? content : Buffer.from(content),
                options: {
                    filename,
                    contentType: "application/x-bittorrent",
                },
            },
            ...(typeof options === "object" ? options : {}),
        }

        this.post("torrents/add", { formData }, (err, res, body) => this.handleError(cb)(err, res, body))
    }

    addTorrentURL(magneturl: string, options: Record<string, any> | undefined, cb: (err?: any, body?: any) => void) {
        this.post("torrents/add", {
            formData: {
                urls: magneturl,
                ...(typeof options === "object" ? options : {}),
            },
        }, (err, res, body) => this.handleError(cb)(err, res, body))
    }

    private performPostAction(action: string, hashes: string[] | string, form: Record<string, any>, cb: (err?: any, body?: any) => void) {
        const list = Array.isArray(hashes) ? hashes : [hashes]
        this.post(`torrents/${action}`, {
            form: {
                hashes: list.join("|"),
                ...form,
            },
        }, (err, res, body) => this.handleError(cb, TORRENT_ERRORS)(err, res, body))
    }

    pause(hashes: string[] | string, cb: (err?: any, body?: any) => void) {
        this.performPostAction(this.useStartStopEndpoints ? "stop" : "pause", hashes, {}, cb)
    }

    pauseAll(cb: (err?: any, body?: any) => void) {
        this.performPostAction(this.useStartStopEndpoints ? "stop" : "pause", "all", {}, cb)
    }

    resume(hashes: string[] | string, cb: (err?: any, body?: any) => void) {
        this.performPostAction(this.useStartStopEndpoints ? "start" : "resume", hashes, {}, cb)
    }

    resumeAll(cb: (err?: any, body?: any) => void) {
        this.performPostAction(this.useStartStopEndpoints ? "start" : "resume", "all", {}, cb)
    }

    delete(hashes: string[], cb: (err?: any, body?: any) => void) {
        this.performPostAction("delete", hashes, { deleteFiles: false }, cb)
    }

    deleteAndRemove(hashes: string[], cb: (err?: any, body?: any) => void) {
        this.performPostAction("delete", hashes, { deleteFiles: true }, cb)
    }

    recheck(hashes: string[], cb: (err?: any, body?: any) => void) {
        this.performPostAction("recheck", hashes, {}, cb)
    }

    increasePrio(hashes: string[], cb: (err?: any, body?: any) => void) {
        this.performPostAction("increasePrio", hashes, {}, cb)
    }

    decreasePrio(hashes: string[], cb: (err?: any, body?: any) => void) {
        this.performPostAction("decreasePrio", hashes, {}, cb)
    }

    topPrio(hashes: string[], cb: (err?: any, body?: any) => void) {
        this.performPostAction("topPrio", hashes, {}, cb)
    }

    bottomPrio(hashes: string[], cb: (err?: any, body?: any) => void) {
        this.performPostAction("bottomPrio", hashes, {}, cb)
    }

    setCategory(hashes: string[], category: string, cb: (err?: any, body?: any) => void) {
        this.performPostAction("setCategory", hashes, { category }, cb)
    }

    createCategory(category: string, savePath: string, cb: (err?: any, body?: any) => void) {
        this.post("torrents/createCategory", { form: { category, savePath } }, cb)
    }

    toggleSequentialDownload(hashes: string[], cb: (err?: any, body?: any) => void) {
        this.performPostAction("toggleSequentialDownload", hashes, {}, cb)
    }
}
