import axios, { AxiosInstance } from 'axios'
import httpAdapter from 'axios/lib/adapters/http.js'

import type { BittorrentServerConfig } from '../../../../shared/ipc-contract'
import { createHttpsAgent, serverUrl } from '../helpers'
import type { BittorrentRuntime } from '../types'

const SESSION_ID_HEADER = 'X-Transmission-Session-Id'

const TRANSMISSION_FIELDS = [
    'activityDate',
    'addedDate',
    'bandwidthPriority',
    'comment',
    'corruptEver',
    'creator',
    'dateCreated',
    'desiredAvailable',
    'doneDate',
    'downloadDir',
    'downloadedEver',
    'downloadLimit',
    'downloadLimited',
    'error',
    'errorString',
    'eta',
    'etaIdle',
    'files',
    'fileStats',
    'hashString',
    'haveUnchecked',
    'haveValid',
    'honorsSessionLimits',
    'id',
    'isFinished',
    'isPrivate',
    'isStalled',
    'leftUntilDone',
    'magnetLink',
    'manualAnnounceTime',
    'maxConnectedPeers',
    'metadataPercentComplete',
    'name',
    'peer-limit',
    'peers',
    'peersConnected',
    'peersFrom',
    'peersGettingFromUs',
    'peersSendingToUs',
    'percentDone',
    'pieces',
    'pieceCount',
    'pieceSize',
    'priorities',
    'queuePosition',
    'rateDownload',
    'rateUpload',
    'recheckProgress',
    'secondsDownloading',
    'secondsSeeding',
    'seedIdleLimit',
    'seedIdleMode',
    'seedRatioLimit',
    'seedRatioMode',
    'sizeWhenDone',
    'startDate',
    'status',
    'trackers',
    'trackerStats',
    'totalSize',
    'torrentFile',
    'uploadedEver',
    'uploadLimit',
    'uploadLimited',
    'uploadRatio',
    'wanted',
    'webseeds',
    'webseedsSendingToUs',
]

export class TransmissionRuntime implements BittorrentRuntime {
    private server!: BittorrentServerConfig
    private session?: string

    private url(pathValue = '') {
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
            adapter: httpAdapter,
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

        await this.getHttpClient().post(this.url(), { method: 'session-get' }, {
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
            method: 'torrent-get',
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
            'download-dir': uploadOptions.saveLocation,
            paused: !uploadOptions.startTorrent,
        })
    }

    async addTorrentUrl(uri: string, uploadOptions?: Record<string, any>): Promise<void> {
        const resp = await this.getHttpClient().post(this.url(), {
            arguments: {
                filename: uri,
                ...this.getUploadOptions(uploadOptions),
            },
            method: 'torrent-add',
        }, {})

        if ('torrent-duplicate' in resp.data.arguments) {
            throw new Error('Could not add duplicate torrent to transmission')
        }
        if (resp.data.result !== 'success') {
            throw new Error(`Could not add torrent to transmission: ${resp.data.result}`)
        }
    }

    async uploadTorrent(buffer: Uint8Array, _filename: string, uploadOptions?: Record<string, any>): Promise<void> {
        const resp = await this.getHttpClient().post(this.url(), {
            arguments: {
                metainfo: Buffer.from(buffer).toString('base64'),
                ...this.getUploadOptions(uploadOptions),
            },
            method: 'torrent-add',
        }, {})

        if ('torrent-duplicate' in resp.data.arguments) {
            throw new Error('Could not add duplicate torrent to transmission')
        }
        if (resp.data.result !== 'success') {
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
        return this.doAction('torrent-start', hashes).then(() => undefined)
    }

    stop(hashes: string[]): Promise<void> {
        return this.doAction('torrent-stop', hashes).then(() => undefined)
    }

    verify(hashes: string[]): Promise<void> {
        return this.doAction('torrent-verify', hashes).then(() => undefined)
    }

    pauseAll(): Promise<void> {
        return this.doAction('torrent-stop', []).then(() => undefined)
    }

    resumeAll(): Promise<void> {
        return this.doAction('torrent-start', []).then(() => undefined)
    }

    queueUp(hashes: string[]): Promise<void> {
        return this.doAction('queue-move-up', hashes).then(() => undefined)
    }

    queueDown(hashes: string[]): Promise<void> {
        return this.doAction('queue-move-down', hashes).then(() => undefined)
    }

    remove(hashes: string[]): Promise<void> {
        return this.doAction('torrent-remove', hashes).then(() => undefined)
    }

    removeAndLocal(hashes: string[]): Promise<void> {
        return this.doAction('torrent-remove', hashes, 'delete-local-data', true).then(() => undefined)
    }
}
