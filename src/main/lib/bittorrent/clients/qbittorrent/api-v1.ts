import { AUTH_ERRORS, QBittorrentBaseApi, TORRENT_ERRORS } from "./base-api"

export class QBittorrentApiV1 extends QBittorrentBaseApi {
    protected buildPath(name: string) {
        const suffix = name.replace(/^\/+/, "")
        return this.basePath ? `${this.basePath}/${suffix}` : `/${suffix}`
    }

    login(cb: (err?: any, body?: any) => void) {
        this.post("login", this.loginRequestOptions({
            form: {
                username: this.user,
                password: this.pass,
            },
        }), (err, res, body) => {
            if (!err && res && !Object.prototype.hasOwnProperty.call(res.headers || {}, "set-cookie")) {
                cb(new Error("Invalid login"), body)
                return
            }

            this.handleError(cb, AUTH_ERRORS)(err, res, body)
        })
    }

    getVersion(cb: (err?: any, version?: string) => void) {
        this.get("version/qbittorrent", {}, (err, res, body) => {
            this.handleError(cb)(err, res, body)
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

    getTorrentTrackers(hash: string, cb: (err?: any, body?: any) => void) {
        this.getJson(`query/propertiesTrackers/${hash}`, {}, (err, res, body) => {
            this.handleError(cb, TORRENT_ERRORS)(err, res, body)
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

        this.post("command/upload", { formData }, (err, res, body) => {
            this.handleError(cb)(err, res, body)
        })
    }

    addTorrentURL(magneturl: string, options: Record<string, any> | undefined, cb: (err?: any, body?: any) => void) {
        this.post("command/download", {
            formData: {
                urls: magneturl,
                ...(typeof options === "object" ? options : {}),
            },
        }, (err, res, body) => this.handleError(cb)(err, res, body))
    }

    private performPostAction(action: string, hashes: string[] | string, form: Record<string, any>, cb: (err?: any, body?: any) => void) {
        const list = Array.isArray(hashes) ? hashes : [hashes]
        this.post(`command/${action}`, {
            form: {
                hashes: list.join("|"),
                ...form,
            },
        }, (err, res, body) => this.handleError(cb, TORRENT_ERRORS)(err, res, body))
    }

    private performMultiPostAction(action: string, hashes: string[] | string, form: Record<string, any>, cb: (err?: any, body?: any) => void) {
        const list = Array.isArray(hashes) ? hashes : [hashes]
        Promise.all(list.map((hash) => new Promise<void>((resolve, reject) => {
            this.post(`command/${action}`, {
                form: {
                    hash,
                    ...form,
                },
            }, (err, res, body) => {
                this.handleError((actionErr) => actionErr ? reject(actionErr) : resolve(), TORRENT_ERRORS)(err, res, body)
            })
        }))).then(() => cb()).catch((err) => cb(err))
    }

    pause(hashes: string[] | string, cb: (err?: any, body?: any) => void) {
        this.performMultiPostAction("pause", hashes, {}, cb)
    }

    pauseAll(cb: (err?: any, body?: any) => void) {
        this.post("command/pauseAll", {}, (err, res, body) => this.handleError(cb)(err, res, body))
    }

    resume(hashes: string[] | string, cb: (err?: any, body?: any) => void) {
        this.performMultiPostAction("resume", hashes, {}, cb)
    }

    resumeAll(cb: (err?: any, body?: any) => void) {
        this.post("command/resumeAll", {}, (err, res, body) => this.handleError(cb)(err, res, body))
    }

    delete(hashes: string[], cb: (err?: any, body?: any) => void) {
        this.performPostAction("delete", hashes, {}, cb)
    }

    deleteAndRemove(hashes: string[], cb: (err?: any, body?: any) => void) {
        this.performPostAction("deletePerm", hashes, {}, cb)
    }

    recheck(hashes: string[], cb: (err?: any, body?: any) => void) {
        this.performMultiPostAction("recheck", hashes, {}, cb)
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

    setLocation(hashes: string[], location: string, cb: (err?: any, body?: any) => void) {
        this.performPostAction("setLocation", hashes, { location }, cb)
    }

    createCategory(category: string, _savePath: string, cb: (err?: any, body?: any) => void) {
        this.post("command/addCategory", { form: { category } }, (err, res, body) => this.handleError(cb)(err, res, body))
    }

    toggleSequentialDownload(hashes: string[], cb: (err?: any, body?: any) => void) {
        this.performPostAction("toggleSequentialDownload", hashes, {}, cb)
    }
}
