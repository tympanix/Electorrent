import axios, { AxiosResponse, AxiosInstance } from "axios"
import FormData from "form-data"
import type { BittorrentServerConfig } from "../../../../common/ipc-contract"
import { createHttpsAgent, serverUrl } from "../helpers"
import type { BittorrentRuntime } from "../types"

const API_INFO = "SYNO.API.Info"
const API_TASK = "SYNO.DownloadStation.Task"
const API_AUTH = "SYNO.API.Auth"

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

export class SynologyRuntime implements BittorrentRuntime {
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
