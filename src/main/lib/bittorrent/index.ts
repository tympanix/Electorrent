import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios"
import FormData from "form-data"
import qs from "qs"
import https from "https"
import type { WebContents } from "electron"
import type {
    BittorrentAddTorrentUrlRequest,
    BittorrentFileSelection,
    BittorrentInvokeActionRequest,
    BittorrentServerConfig,
    BittorrentSetTorrentFileSelectionRequest,
    BittorrentUploadTorrentRequest,
} from "../../../common/ipc-contract"

const QBittorrent = require("@electorrent/node-qbittorrent")
const Rtorrent = require("@electorrent/node-rtorrent")
const Deluge = require("@electorrent/node-deluge")

type CallbackFunc<T = any> = (err: any, val: T) => void

interface BittorrentRuntime {
    connect(server: BittorrentServerConfig): Promise<void>
    getSnapshot(fullUpdate?: boolean): Promise<any>
    addTorrentUrl(uri: string, options?: Record<string, any>): Promise<void>
    uploadTorrent(buffer: Uint8Array, filename: string, options?: Record<string, any>): Promise<void>
    getTorrentFiles?(hash: string): Promise<any>
    setTorrentFileSelection?(hash: string, files: BittorrentFileSelection[]): Promise<void>
    disconnect?(): Promise<void>
    [key: string]: any
}

const URL_REGEX = /^[a-z]+:\/\/(?:[a-z0-9-]+\.)*((?:[a-z0-9-]+\.)[a-z]+)/
const SESSION_ID_HEADER = "X-Transmission-Session-Id"
const API_INFO = "SYNO.API.Info"
const API_TASK = "SYNO.DownloadStation.Task"
const API_AUTH = "SYNO.API.Auth"
const QBITTORRENT_PRIORITY_SKIP = 0
const QBITTORRENT_PRIORITY_NORMAL = 1

const ERR_COM: Record<number, string> = {
    100: "Unknown error.",
    101: "Invalid parameter.",
    102: "The requested API does not exist.",
    103: "The requested method does not exist.",
    104: "The requested version does not support the functionality.",
    105: "The logged in session does not have permission.",
    106: "Session timeout.",
    107: "Session interrupted by duplicate login.",
}

const ERR_AUTH: Record<number, string> = {
    400: "No such account or incorrect password.",
    401: "Account disabled.",
    402: "Permission denied.",
    403: "2-step verfication code required.",
    404: "Faield to authenticate 2-step verification code.",
}

const ERR_TASK: Record<number, string> = {
    400: "File upload failed.",
    401: "Max number of tasks reached.",
    402: "Destination denied.",
    403: "Destination does not exist.",
    404: "Invalid task id.",
    405: "Invalid task action.",
    406: "No default destination.",
    407: "Set destination failed.",
    408: "File does not exist.",
}

const TRANSMISSION_FIELDS = [
    "activityDate",
    "addedDate",
    "bandwidthPriority",
    "comment",
    "corruptEver",
    "creator",
    "dateCreated",
    "desiredAvailable",
    "doneDate",
    "downloadDir",
    "downloadedEver",
    "downloadLimit",
    "downloadLimited",
    "error",
    "errorString",
    "eta",
    "etaIdle",
    "files",
    "fileStats",
    "hashString",
    "haveUnchecked",
    "haveValid",
    "honorsSessionLimits",
    "id",
    "isFinished",
    "isPrivate",
    "isStalled",
    "leftUntilDone",
    "magnetLink",
    "manualAnnounceTime",
    "maxConnectedPeers",
    "metadataPercentComplete",
    "name",
    "peer-limit",
    "peers",
    "peersConnected",
    "peersFrom",
    "peersGettingFromUs",
    "peersSendingToUs",
    "percentDone",
    "pieces",
    "pieceCount",
    "pieceSize",
    "priorities",
    "queuePosition",
    "rateDownload",
    "rateUpload",
    "recheckProgress",
    "secondsDownloading",
    "secondsSeeding",
    "seedIdleLimit",
    "seedIdleMode",
    "seedRatioLimit",
    "seedRatioMode",
    "sizeWhenDone",
    "startDate",
    "status",
    "trackers",
    "trackerStats",
    "totalSize",
    "torrentFile",
    "uploadedEver",
    "uploadLimit",
    "uploadLimited",
    "uploadRatio",
    "wanted",
    "webseeds",
    "webseedsSendingToUs",
]

function defer<T>(fn: (f: CallbackFunc<T>) => void): Promise<T> {
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

function cleanPath(pathValue?: string) {
    const raw = pathValue || ""
    const trimmed = raw.replace(/^\/+|\/+$/g, "")
    return trimmed ? `/${trimmed}` : ""
}

function serverUrl(server: BittorrentServerConfig) {
    return `${server.proto}://${server.ip}:${server.port}${cleanPath(server.path)}`
}

function createHttpsAgent(server: BittorrentServerConfig) {
    return new https.Agent({
        ca: server.certificateData ? Buffer.from(server.certificateData) : undefined,
    })
}

class QBittorrentRuntime implements BittorrentRuntime {
    private qbittorrent: any

    connect(server: BittorrentServerConfig): Promise<void> {
        this.qbittorrent = new QBittorrent({
            host: serverUrl(server),
            port: server.port,
            path: cleanPath(server.path),
            user: server.user,
            pass: server.password,
            ca: server.certificateData,
        })

        return defer((done) => this.qbittorrent.login(done))
    }

    getSnapshot(fullUpdate?: boolean): Promise<any> {
        let promise = Promise.resolve()
        if (fullUpdate) {
            promise = promise.then(() => defer((done) => this.qbittorrent.reset(done)))
        }

        return promise.then(() => defer((done) => this.qbittorrent.syncMaindata(done)))
    }

    private getHttpUploadOptions(options?: Record<string, any>) {
        if (!options) {
            return undefined
        }

        const qbittorrentOptions: Record<string, any> = {
            savepath: options.saveLocation,
            category: options.category,
            skip_checking: options.skipCheck,
            paused: !options.startTorrent,
            stopped: !options.startTorrent,
            rename: options.renameTorrent,
            upLimit: options.uploadSpeedLimit,
            dlLimit: options.downloadSpeedLimit,
            sequentialDownload: options.sequentialDownload,
            firstLastPiecePrio: options.firstAndLastPiecePrio,
        }

        return Object.fromEntries(
            Object.entries(qbittorrentOptions)
                .filter(([, value]) => value !== undefined && value !== null)
                .map(([key, value]) => [key, value.toString()]),
        )
    }

    addTorrentUrl(uri: string, options?: Record<string, any>): Promise<void> {
        return defer((done) => this.qbittorrent.addTorrentURL(uri, this.getHttpUploadOptions(options), done))
    }

    uploadTorrent(buffer: Uint8Array, filename: string, options?: Record<string, any>): Promise<void> {
        return defer((done) => this.qbittorrent.addTorrentFileContent(Buffer.from(buffer), filename, this.getHttpUploadOptions(options), done))
    }

    resume(hashes: string[]): Promise<void> {
        return defer((done) => this.qbittorrent.resume(hashes, done))
    }

    resumeAll(): Promise<void> {
        return defer((done) => this.qbittorrent.resumeAll(done))
    }

    pause(hashes: string[]): Promise<void> {
        return defer((done) => this.qbittorrent.pause(hashes, done))
    }

    pauseAll(): Promise<void> {
        return defer((done) => this.qbittorrent.pauseAll(done))
    }

    recheck(hashes: string[]): Promise<void> {
        return defer((done) => this.qbittorrent.recheck(hashes, done))
    }

    increasePrio(hashes: string[]): Promise<void> {
        return defer((done) => this.qbittorrent.increasePrio(hashes, done))
    }

    decreasePrio(hashes: string[]): Promise<void> {
        return defer((done) => this.qbittorrent.decreasePrio(hashes, done))
    }

    topPrio(hashes: string[]): Promise<void> {
        return defer((done) => this.qbittorrent.topPrio(hashes, done))
    }

    bottomPrio(hashes: string[]): Promise<void> {
        return defer((done) => this.qbittorrent.bottomPrio(hashes, done))
    }

    toggleSequentialDownload(hashes: string[]): Promise<void> {
        return defer((done) => this.qbittorrent.toggleSequentialDownload(hashes, done))
    }

    delete(hashes: string[]): Promise<void> {
        return defer((done) => this.qbittorrent.delete(hashes, done))
    }

    deleteAndRemove(hashes: string[]): Promise<void> {
        return defer((done) => this.qbittorrent.deleteAndRemove(hashes, done))
    }

    async setCategory(hashes: string[], category: string, create?: boolean): Promise<void> {
        if (create === true) {
            await defer((done) => this.qbittorrent.createCategory(category, "", done))
        }
        await defer((done) => this.qbittorrent.setCategory(hashes, category, done))
    }

    getTorrentFiles(hash: string): Promise<any> {
        const api = this.qbittorrent?.api
        if (!api || typeof api.getJson !== "function") {
            return Promise.reject(new Error("qBittorrent API does not support getTorrentFiles"))
        }

        return new Promise((resolve, reject) => {
            api.getJson("torrents/files", { qs: { hash } }, (err: any, _res: any, body: any) => {
                if (err) {
                    reject(err)
                    return
                }
                resolve(body)
            })
        })
    }

    async setTorrentFileSelection(hash: string, files: BittorrentFileSelection[]): Promise<void> {
        const api = this.qbittorrent?.api
        if (!api || typeof api.post !== "function") {
            throw new Error("qBittorrent API does not support setTorrentFileSelection")
        }

        const wantedIds = files.filter((file) => file.wanted).map((file) => file.index)
        const unwantedIds = files.filter((file) => !file.wanted).map((file) => file.index)

        const setPriority = (ids: number[], priority: number) => new Promise<void>((resolve, reject) => {
            if (ids.length === 0) {
                resolve()
                return
            }

            api.post("torrents/filePrio", {
                form: {
                    hash,
                    id: ids.join("|"),
                    priority: String(priority),
                },
            }, (err: any) => {
                if (err) {
                    reject(err)
                } else {
                    resolve()
                }
            })
        })

        await setPriority(unwantedIds, QBITTORRENT_PRIORITY_SKIP)
        await setPriority(wantedIds, QBITTORRENT_PRIORITY_NORMAL)
    }
}

class RtorrentRuntime implements BittorrentRuntime {
    private rtorrent: any

    connect(server: BittorrentServerConfig): Promise<void> {
        this.rtorrent = new Rtorrent({
            host: server.ip,
            port: server.port,
            path: cleanPath(server.path),
            user: server.user,
            pass: server.password,
            ssl: server.proto === "https",
            ca: server.certificateData,
        })

        return defer((done) => this.rtorrent.get("system.client_version", [], done))
    }

    getSnapshot(): Promise<any> {
        return defer((done) => this.rtorrent.getTorrentsExtra(done))
    }

    addTorrentUrl(uri: string): Promise<void> {
        return defer((done) => this.rtorrent.loadLink(uri, done))
    }

    uploadTorrent(buffer: Uint8Array): Promise<void> {
        return defer((done) => this.rtorrent.loadFileContent(Buffer.from(buffer), done))
    }

    start(hashes: string[]): Promise<void> {
        return defer((done) => this.rtorrent.start(hashes, done))
    }

    stop(hashes: string[]): Promise<void> {
        return defer((done) => this.rtorrent.stop(hashes, done))
    }

    label(hashes: string[], label: string): Promise<void> {
        return defer((done) => this.rtorrent.setLabel(hashes, label, done))
    }

    remove(hashes: string[]): Promise<void> {
        return defer((done) => this.rtorrent.remove(hashes, done))
    }

    deleteAndErase(hashes: string[]): Promise<void> {
        return defer((done) => this.rtorrent.removeAndErase(hashes, done))
    }

    recheck(hashes: string[]): Promise<void> {
        return defer((done) => this.rtorrent.recheck(hashes, done))
    }

    priorityHigh(hashes: string[]): Promise<void> {
        return defer((done) => this.rtorrent.setPriorityHigh(hashes, done))
    }

    priorityNormal(hashes: string[]): Promise<void> {
        return defer((done) => this.rtorrent.setPriorityNormal(hashes, done))
    }

    priorityLow(hashes: string[]): Promise<void> {
        return defer((done) => this.rtorrent.setPriorityLow(hashes, done))
    }

    priorityOff(hashes: string[]): Promise<void> {
        return defer((done) => this.rtorrent.setPriorityOff(hashes, done))
    }
}

class DelugeRuntime implements BittorrentRuntime {
    private deluge: any

    async connect(server: BittorrentServerConfig): Promise<void> {
        this.deluge = new Deluge({
            host: serverUrl(server),
            port: server.port,
            path: cleanPath(server.path),
            pass: server.password,
            ca: server.certificateData,
        })

        await defer((done) => this.deluge.login(done))
        await this.deluge.connect(0)
    }

    getSnapshot(): Promise<any> {
        return defer((done) => this.deluge.getTorrents(done))
    }

    addTorrentUrl(uri: string): Promise<void> {
        return defer((done) => this.deluge.addTorrentURL(uri, {}, done))
    }

    uploadTorrent(buffer: Uint8Array): Promise<void> {
        return defer((done) => this.deluge.addTorrent(Buffer.from(buffer), {}, done))
    }

    resume(hashes: string[]): Promise<void> {
        return defer((done) => this.deluge.resume(hashes, done))
    }

    pause(hashes: string[]): Promise<void> {
        return defer((done) => this.deluge.pause(hashes, done))
    }

    verify(hashes: string[]): Promise<void> {
        return defer((done) => this.deluge.verify(hashes, done))
    }

    remove(hashes: string[]): Promise<void> {
        return defer((done) => this.deluge.remove(hashes, done))
    }

    removeAndDelete(hashes: string[]): Promise<void> {
        return defer((done) => this.deluge.removeAndDelete(hashes, done))
    }

    queueUp(hashes: string[]): Promise<void> {
        return defer((done) => this.deluge.queueUp(hashes, done))
    }

    queueDown(hashes: string[]): Promise<void> {
        return defer((done) => this.deluge.queueDown(hashes, done))
    }

    queueTop(hashes: string[]): Promise<void> {
        return defer((done) => this.deluge.queueTop(hashes, done))
    }

    queueBottom(hashes: string[]): Promise<void> {
        return defer((done) => this.deluge.queueBottom(hashes, done))
    }
}

class TransmissionRuntime implements BittorrentRuntime {
    private server!: BittorrentServerConfig
    private session?: string

    private url(pathValue = "") {
        return `${serverUrl(this.server)}${pathValue}`
    }

    private updateSession(res: any) {
        if (axios.isAxiosError(res)) {
            return res
        }

        if (res instanceof Error) {
            throw res
        }

        const session = res.headers?.[SESSION_ID_HEADER.toLowerCase()]
        if (session) {
            this.session = session
        }

        return res
    }

    private handleErrors(res: any) {
        if (axios.isAxiosError(res) || res instanceof Error) {
            throw res
        }
        return res
    }

    private retryResponseInterceptor(res: any) {
        if (res.status === 409 && res.config) {
            return this.getHttpClient(true).request(res.config)
        }
        return res
    }

    private getHttpClient(allowFail?: boolean): AxiosInstance {
        const http = axios.create({
            auth: {
                username: this.server.user,
                password: this.server.password,
            },
            httpsAgent: createHttpsAgent(this.server),
            adapter: require("axios/lib/adapters/http"),
        })

        http.interceptors.response.use(
            (res) => this.updateSession(res),
            (error) => Promise.reject(this.updateSession(error as any)),
        )

        http.interceptors.request.use((config) => {
            const headers = (config.headers || {}) as any
            config.headers = headers
            if (this.session) {
                headers[SESSION_ID_HEADER] = this.session
            }
            return config
        })

        if (allowFail) {
            http.interceptors.response.use(
                (res) => this.retryResponseInterceptor(res),
                (res) => this.retryResponseInterceptor(res),
            )
        }

        http.interceptors.response.use(
            (res) => this.handleErrors(res),
            (error) => Promise.reject(this.handleErrors(error as any)),
        )

        return http
    }

    async connect(server: BittorrentServerConfig): Promise<void> {
        this.server = server
        this.session = undefined

        await this.getHttpClient().post(this.url(), { method: "session-get" }, {
            timeout: 5000,
            auth: {
                username: server.user,
                password: server.password,
            },
            validateStatus: (status) => status === 200 || status === 409,
        })
    }

    async getSnapshot(): Promise<any> {
        const resp = await this.getHttpClient().post(this.url(), {
            arguments: {
                fields: TRANSMISSION_FIELDS,
            },
            method: "torrent-get",
        })

        return resp.data
    }

    private removeEmpty(obj: Record<string, any>) {
        return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== null && value !== undefined))
    }

    private getUploadOptions(uploadOptions?: Record<string, any>) {
        if (!uploadOptions) {
            return {}
        }

        return this.removeEmpty({
            "download-dir": uploadOptions.saveLocation,
            paused: !uploadOptions.startTorrent,
        })
    }

    async addTorrentUrl(uri: string, uploadOptions?: Record<string, any>): Promise<void> {
        const resp = await this.getHttpClient().post(this.url(), {
            arguments: {
                filename: uri,
                ...this.getUploadOptions(uploadOptions),
            },
            method: "torrent-add",
        }, {})

        if ("torrent-duplicate" in resp.data.arguments) {
            throw new Error("Could not add duplicate torrent to transmission")
        }
        if (resp.data.result !== "success") {
            throw new Error(`Could not add torrent to transmission: ${resp.data.result}`)
        }
    }

    async uploadTorrent(buffer: Uint8Array, _filename: string, uploadOptions?: Record<string, any>): Promise<void> {
        const resp = await this.getHttpClient().post(this.url(), {
            arguments: {
                metainfo: Buffer.from(buffer).toString("base64"),
                ...this.getUploadOptions(uploadOptions),
            },
            method: "torrent-add",
        }, {})

        if ("torrent-duplicate" in resp.data.arguments) {
            throw new Error("Could not add duplicate torrent to transmission")
        }
        if (resp.data.result !== "success") {
            throw new Error(`Could not add torrent to transmission: ${resp.data.result}`)
        }
    }

    private doAction(command: string, hashes: string[], mutator?: string, value?: any) {
        const data: Record<string, any> = {
            arguments: { ids: null },
            method: command,
        }

        if (hashes.length) {
            data.arguments.ids = hashes
        }

        if (mutator) {
            data.arguments[mutator] = value
        }

        return this.getHttpClient().post(this.url(), data)
    }

    start(hashes: string[]): Promise<void> {
        return this.doAction("torrent-start", hashes).then(() => undefined)
    }

    stop(hashes: string[]): Promise<void> {
        return this.doAction("torrent-stop", hashes).then(() => undefined)
    }

    verify(hashes: string[]): Promise<void> {
        return this.doAction("torrent-verify", hashes).then(() => undefined)
    }

    pauseAll(): Promise<void> {
        return this.doAction("torrent-stop", []).then(() => undefined)
    }

    resumeAll(): Promise<void> {
        return this.doAction("torrent-start", []).then(() => undefined)
    }

    queueUp(hashes: string[]): Promise<void> {
        return this.doAction("queue-move-up", hashes).then(() => undefined)
    }

    queueDown(hashes: string[]): Promise<void> {
        return this.doAction("queue-move-down", hashes).then(() => undefined)
    }

    remove(hashes: string[]): Promise<void> {
        return this.doAction("torrent-remove", hashes).then(() => undefined)
    }

    removeAndLocal(hashes: string[]): Promise<void> {
        return this.doAction("torrent-remove", hashes, "delete-local-data", true).then(() => undefined)
    }
}

class UtorrentRuntime implements BittorrentRuntime {
    private server!: BittorrentServerConfig
    private http!: AxiosInstance
    private data = {
        url: "",
        username: "",
        password: "",
        token: "",
        cid: 0,
        build: -1,
    }

    private url(pathValue = "") {
        return `${serverUrl(this.server)}${pathValue}`
    }

    private saveConnection(urlValue: string, username: string, password: string) {
        this.data.username = username
        this.data.password = password
        this.data.url = urlValue
    }

    private extractTokenFromHTML(str: string) {
        const match = str.match(/>([^<]+)</)
        if (match) {
            this.data.token = match[match.length - 1]
            return true
        }
        return false
    }

    async connect(server: BittorrentServerConfig): Promise<void> {
        this.server = server

        this.http = axios.create({
            auth: {
                username: server.user,
                password: server.password,
            },
            httpsAgent: createHttpsAgent(server),
            paramsSerializer: (params) => qs.stringify(params, { arrayFormat: "repeat" }),
            adapter: require("axios/lib/adapters/http"),
        })

        this.http.interceptors.response.use((res) => {
            if (res.data && res.data.torrentc !== undefined) {
                this.data.cid = res.data.torrentc
            }
            return res
        })

        this.http.interceptors.response.use((res) => {
            const cookie = res.headers["set-cookie"]
            if (cookie && cookie.length) {
                this.http.defaults.headers.common.Cookie = cookie[0]
            }
            return res
        })

        this.http.interceptors.response.use((res) => {
            const error = res?.data?.error
            if (typeof error === "string") {
                throw new Error(error)
            }
            return res
        })

        const res = await this.http.get(`${this.url()}/token.html`, {
            timeout: 5000,
            params: {
                t: Date.now(),
            },
        })

        if (res.status === 401 || res.status === 402) {
            throw new Error("Invalid credentials")
        }
        if (res.status !== 200) {
            throw new Error("Invalid information provided to server")
        }
        if (!this.extractTokenFromHTML(res.data)) {
            throw new Error("Failed to authenticate with server")
        }

        this.saveConnection(serverUrl(server), server.user, server.password)
    }

    addTorrentUrl(uri: string, options?: Record<string, any>): Promise<void> {
        return this.http.get(`${this.data.url}/`, {
            params: {
                token: this.data.token,
                t: Date.now(),
                action: "add-url",
                s: uri,
                download_dir: options?.saveLocation || 0,
                path: "",
            },
        }).then(() => undefined)
    }

    async uploadTorrent(buffer: Uint8Array, filename?: string, options?: Record<string, any>): Promise<void> {
        const formData = new FormData()
        formData.append("torrent_file", Buffer.from(buffer), {
            filename: filename || "upload.torrent",
            contentType: "application/x-bittorrent",
        })

        const contentLength = await new Promise<number>((resolve, reject) => {
            formData.getLength((err, length) => err ? reject(err) : resolve(length))
        })

        await this.http.post(`${this.data.url}/`, formData, {
            params: {
                token: this.data.token,
                action: "add-file",
                download_dir: options?.saveLocation || 0,
                path: "",
            },
            headers: {
                ...formData.getHeaders(),
                "Content-Length": contentLength.toString(),
            },
        })
    }

    async getSnapshot(): Promise<any> {
        const res = await this.http.get(`${this.data.url}/`, {
            params: {
                token: this.data.token,
                cid: this.data.cid,
                t: Date.now(),
                list: 1,
            },
        })

        return res.data
    }

    private doAction(action: string, hashes: string[]): Promise<void> {
        return this.http.get(`${this.data.url}/`, {
            params: {
                action,
                hash: hashes,
                token: this.data.token,
                cid: this.data.cid,
                t: Date.now(),
            },
        }).then(() => undefined)
    }

    start(hashes: string[]): Promise<void> {
        return this.doAction("start", hashes)
    }

    stop(hashes: string[]): Promise<void> {
        return this.doAction("stop", hashes)
    }

    pause(hashes: string[]): Promise<void> {
        return this.doAction("pause", hashes)
    }

    remove(hashes: string[]): Promise<void> {
        return this.doAction("remove", hashes)
    }

    removedata(hashes: string[]): Promise<void> {
        return this.doAction("removedata", hashes)
    }

    removetorrent(hashes: string[]): Promise<void> {
        return this.doAction("removetorrent", hashes)
    }

    removedatatorrent(hashes: string[]): Promise<void> {
        return this.doAction("removedatatorrent", hashes)
    }

    forcestart(hashes: string[]): Promise<void> {
        return this.doAction("forcestart", hashes)
    }

    recheck(hashes: string[]): Promise<void> {
        return this.doAction("recheck", hashes)
    }

    queueup(hashes: string[]): Promise<void> {
        return this.doAction("queueup", hashes)
    }

    queuedown(hashes: string[]): Promise<void> {
        return this.doAction("queuedown", hashes)
    }

    getprops(hashes: string[]): Promise<void> {
        return this.doAction("getprops", hashes)
    }

    setLabel(hashes: string[], label: string): Promise<void> {
        return this.http.get(`${this.data.url}/`, {
            params: {
                token: this.data.token,
                hash: hashes,
                s: "label",
                v: label,
                action: "setprops",
                t: Date.now(),
            },
        }).then(() => undefined)
    }
}

class SynologyRuntime implements BittorrentRuntime {
    private server!: BittorrentServerConfig
    private http!: AxiosInstance
    private authPath = ""
    private authVersion = ""
    private dlPath = ""
    private dlVersion = ""
    private taskPath = "/DownloadStation/task.cgi"
    private timeout = 6000

    private config(choice: string, args: any[] = []) {
        switch (choice) {
            case "query":
                return {
                    params: {
                        api: API_INFO,
                        version: "1",
                        method: "query",
                        query: "SYNO.API.Auth,SYNO.DownloadStation.Task",
                    },
                    timeout: this.timeout,
                }
            case "auth":
                return {
                    params: {
                        api: API_AUTH,
                        version: this.authVersion,
                        method: "login",
                        account: args[0],
                        passwd: args[1],
                        session: "DownloadStation",
                    },
                    timeout: this.timeout,
                }
            case "torrents":
                return {
                    params: {
                        api: API_TASK,
                        version: this.dlVersion,
                        method: "list",
                        additional: "detail,transfer,tracker",
                    },
                    timeout: this.timeout,
                }
            case "tUrl":
                return {
                    params: {
                        api: API_TASK,
                        version: this.dlVersion,
                        method: "create",
                        uri: args[0],
                    },
                    timeout: this.timeout,
                }
            case "action":
                return {
                    params: {
                        api: API_TASK,
                        version: this.dlVersion,
                        method: args[0],
                        id: args[1],
                    },
                    timeout: this.timeout,
                }
            default:
                return {}
        }
    }

    private handleError(response: AxiosResponse) {
        const data = response.data

        if (data?.error) {
            const code = data.error.code
            if (Object.prototype.hasOwnProperty.call(ERR_COM, code)) {
                throw new Error(ERR_COM[code])
            }
            if (Object.prototype.hasOwnProperty.call(ERR_AUTH, code)) {
                throw new Error(ERR_AUTH[code])
            }
        }

        if (Array.isArray(data?.data)) {
            const errs = data.data.map((item: any) => item.error)
            const singleErrors = errs.filter((code: number) => code > 0)
            if (singleErrors.length === 1) {
                throw new Error(ERR_TASK[singleErrors[0]])
            }
            if (singleErrors.length > 1) {
                throw new Error("Multiple Task Errors! There were multiple errors associated with the task requested.")
            }
        }

        return response
    }

    private isSuccess(data: any) {
        return !!data?.success
    }

    async connect(server: BittorrentServerConfig): Promise<void> {
        this.server = server
        this.http = axios.create({
            httpsAgent: createHttpsAgent(server),
            adapter: require("axios/lib/adapters/http"),
        })

        this.http.interceptors.response.use((res) => {
            const cookie = res.headers["set-cookie"]
            if (cookie && cookie.length) {
                this.http.defaults.headers.common.Cookie = cookie[0]
            }
            return res
        })

        const queryResponse = await this.http.get(`${serverUrl(this.server)}/query.cgi`, this.config("query"))
        this.handleError(queryResponse)
        if (!this.isSuccess(queryResponse.data)) {
            throw new Error(`Getting initial API information from Auth and DownloadStation failed. Error: ${queryResponse.data.error}`)
        }

        this.authPath = `/${queryResponse.data.data[API_AUTH].path}`
        this.authVersion = queryResponse.data.data[API_AUTH].maxVersion
        this.dlPath = `/${queryResponse.data.data[API_TASK].path}`
        this.dlVersion = queryResponse.data.data[API_TASK].maxVersion

        const authResponse = await this.http.get(`${serverUrl(this.server)}${this.authPath}`, this.config("auth", [server.user, server.password]))
        this.handleError(authResponse)
        if (!this.isSuccess(authResponse.data)) {
            throw new Error(`Login failed. Error: ${authResponse.data.error}`)
        }
    }

    async getSnapshot(): Promise<any> {
        const response = await this.http.get(`${serverUrl(this.server)}${this.dlPath}`, this.config("torrents"))
        this.handleError(response)
        if (!this.isSuccess(response.data)) {
            throw new Error(`Retrieving torrent data failed. Error: ${response.data.error}`)
        }
        return response.data.data
    }

    async addTorrentUrl(uri: string): Promise<void> {
        const response = await this.http.get(`${serverUrl(this.server)}${this.taskPath}`, this.config("tUrl", [uri]))
        this.handleError(response)
        if (!this.isSuccess(response.data)) {
            throw new Error(`Create a DownloadStation task with the provided URL failed. Error: ${response.data.error}`)
        }
    }

    async uploadTorrent(buffer: Uint8Array, filename?: string): Promise<void> {
        const formData = new FormData()
        formData.append("api", API_TASK)
        formData.append("version", this.dlVersion)
        formData.append("method", "create")
        formData.append("file", Buffer.from(buffer), {
            filename: filename || "upload.torrent",
            contentType: "application/x-bittorrent",
        })

        const response = await this.http.post(`${serverUrl(this.server)}${this.taskPath}`, formData, {
            headers: formData.getHeaders(),
        })
        this.handleError(response)
    }

    private doAction(action: string, hashes: string[]) {
        return this.http.get(`${serverUrl(this.server)}${this.taskPath}`, this.config("action", [action, hashes.join(",")]))
            .then((response) => this.handleError(response))
            .then(() => undefined)
    }

    start(hashes: string[]): Promise<void> {
        return this.doAction("resume", hashes)
    }

    pause(hashes: string[]): Promise<void> {
        return this.doAction("pause", hashes)
    }

    remove(hashes: string[]): Promise<void> {
        return this.doAction("delete", hashes)
    }
}

function createRuntime(clientId: string): BittorrentRuntime {
    switch (clientId) {
        case "qbittorrent":
            return new QBittorrentRuntime()
        case "rtorrent":
            return new RtorrentRuntime()
        case "deluge":
            return new DelugeRuntime()
        case "transmission":
            return new TransmissionRuntime()
        case "utorrent":
            return new UtorrentRuntime()
        case "synology":
            return new SynologyRuntime()
        default:
            throw new Error(`Unsupported bittorrent client: ${clientId}`)
    }
}

class BittorrentManager {
    private sessions = new Map<number, BittorrentRuntime>()

    private getSession(sender: WebContents) {
        const session = this.sessions.get(sender.id)
        if (!session) {
            throw new Error("No active bittorrent session")
        }
        return session
    }

    async connect(sender: WebContents, server: BittorrentServerConfig): Promise<void> {
        await this.disconnect(sender)
        const runtime = createRuntime(server.client)
        await runtime.connect(server)
        this.sessions.set(sender.id, runtime)
    }

    async disconnect(sender: WebContents): Promise<void> {
        const existing = this.sessions.get(sender.id)
        if (!existing) {
            return
        }
        if (typeof existing.disconnect === "function") {
            await existing.disconnect()
        }
        this.sessions.delete(sender.id)
    }

    getSnapshot(sender: WebContents, fullUpdate?: boolean) {
        return this.getSession(sender).getSnapshot(fullUpdate)
    }

    addTorrentUrl(sender: WebContents, request: BittorrentAddTorrentUrlRequest) {
        return this.getSession(sender).addTorrentUrl(request.uri, request.options)
    }

    uploadTorrent(sender: WebContents, request: BittorrentUploadTorrentRequest) {
        return this.getSession(sender).uploadTorrent(request.data, request.filename, request.options)
    }

    invokeAction(sender: WebContents, request: BittorrentInvokeActionRequest) {
        const runtime = this.getSession(sender)
        const action = runtime[request.action]
        if (typeof action !== "function") {
            throw new Error(`Unsupported bittorrent action: ${request.action}`)
        }
        return action.call(runtime, request.hashes || [], ...(request.args || []))
    }

    getTorrentFiles(sender: WebContents, hash: string) {
        const runtime = this.getSession(sender)
        if (typeof runtime.getTorrentFiles !== "function") {
            throw new Error("Torrent file selection not supported for this client")
        }
        return runtime.getTorrentFiles(hash)
    }

    setTorrentFileSelection(sender: WebContents, request: BittorrentSetTorrentFileSelectionRequest) {
        const runtime = this.getSession(sender)
        if (typeof runtime.setTorrentFileSelection !== "function") {
            throw new Error("Torrent file selection not supported for this client")
        }
        return runtime.setTorrentFileSelection(request.hash, request.files)
    }

    disconnectWindow(sender: WebContents | null | undefined) {
        if (!sender) {
            return Promise.resolve()
        }
        return this.disconnect(sender)
    }
}

export const bittorrentManager = new BittorrentManager()
