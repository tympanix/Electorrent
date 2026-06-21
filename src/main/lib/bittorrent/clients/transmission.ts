import axios, { AxiosInstance } from 'axios'
import httpAdapter from 'axios/lib/adapters/http.js'
import https from 'https'

import type { BittorrentServerConfig, BittorrentTorrentDetailsData, TorrentClientConnection } from '@shared/ipc-contract'
import {
    HTTP_LOGIN_TIMEOUT,
    HTTP_REQUEST_TIMEOUT,
    serverUrl,
} from '@main/lib/bittorrent/helpers'
import type { BittorrentRuntime } from '@main/lib/bittorrent/types'

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
    'labels',
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
    'seedRatioLimit',
    'seedRatioMode',
    'sequentialDownload',
    'sequential_download',
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

    private url(endpoint = '') {
        return serverUrl(this.server, endpoint)
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
            httpsAgent: new https.Agent({
                ca: this.server.certificateData ? Buffer.from(this.server.certificateData) : undefined,
                rejectUnauthorized: this.server.tlsSecurity !== "insecure",
            }),
            adapter: httpAdapter,
            timeout: HTTP_REQUEST_TIMEOUT,
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

    async connect(server: BittorrentServerConfig): Promise<TorrentClientConnection> {
        this.server = server
        this.session = undefined

        let response = await this.getHttpClient().post(this.url(), { method: 'session-get' }, {
            timeout: HTTP_LOGIN_TIMEOUT,
            auth: {
                username: server.user,
                password: server.password,
            },
            validateStatus: (status) => status === 200 || status === 409,
        })
        if (response.status === 409) {
            response = await this.getHttpClient().post(this.url(), { method: 'session-get' }, {
                timeout: HTTP_LOGIN_TIMEOUT,
            })
        }

        const version = response.data?.arguments?.version
        if (typeof version !== 'string' || !version.trim()) {
            throw new Error('Transmission did not return its version')
        }

        return {
            version: version.trim(),
            features: {
                magnetLinks: true,
                labels: true,
                setLocation: true,
                torrentDetails: true,
                trackerFilter: true,
                speedLimits: true,
                ratioLimits: true,
                freeDiskSpace: true,
                uploadOptions: {
                    saveLocation: true,
                    category: true,
                    startTorrent: true,
                    peerLimit: true,
                    sequentialDownload: true,
                    downloadSpeedLimit: true,
                    uploadSpeedLimit: true,
                },
            },
        }
    }

    async getSnapshot(): Promise<any> {
        const [torrentsResponse, sessionResponse] = await Promise.all([
            this.getHttpClient().post(this.url(), {
                arguments: {
                    fields: TRANSMISSION_FIELDS,
                },
                method: 'torrent-get',
            }),
            this.getHttpClient().post(this.url(), { method: 'session-get' }),
        ])

        return {
            ...torrentsResponse.data,
            arguments: {
                ...torrentsResponse.data?.arguments,
                freeDiskSpace: sessionResponse.data?.arguments?.['download-dir-free-space'],
            },
        }
    }

    async getTorrentDetails(hash: string): Promise<BittorrentTorrentDetailsData> {
        const response = await this.getHttpClient().post(this.url(), {
            arguments: {
                ids: [hash],
                fields: TRANSMISSION_FIELDS,
            },
            method: 'torrent-get',
        })

        const torrent = response?.data?.arguments?.torrents?.[0]
        if (!torrent) {
            throw new Error('Transmission did not return torrent details')
        }

        const files = Array.isArray(torrent.files) ? torrent.files : []
        const fileStats = Array.isArray(torrent.fileStats) ? torrent.fileStats : []
        const wanted = Array.isArray(torrent.wanted) ? torrent.wanted : []
        const priorities = Array.isArray(torrent.priorities) ? torrent.priorities : []

        return {
            info: {
                hash,
                savePath: torrent.downloadDir ?? null,
                creationDate: torrent.dateCreated ?? null,
                pieceSize: torrent.pieceSize ?? null,
                comment: torrent.comment ?? null,
                totalDownloaded: torrent.downloadedEver ?? null,
                totalUploaded: torrent.uploadedEver ?? null,
                uploadLimit: torrent.uploadLimited ? (torrent.uploadLimit ?? null) : -1,
                downloadLimit: torrent.downloadLimited ? (torrent.downloadLimit ?? null) : -1,
                timeElapsed: (torrent.secondsDownloading ?? 0) + (torrent.secondsSeeding ?? 0),
                seedingTime: torrent.secondsSeeding ?? null,
                connections: torrent.peersConnected ?? null,
                connectionsLimit: torrent.maxConnectedPeers ?? null,
                shareRatio: torrent.uploadRatio ?? null,
                ratioLimit: torrent.seedRatioMode > 0 ? (torrent.seedRatioLimit ?? null) : null,
                additionDate: torrent.addedDate ?? null,
                completionDate: torrent.doneDate ?? null,
                createdBy: torrent.creator ?? null,
                downloadSpeed: torrent.rateDownload ?? null,
                eta: torrent.eta ?? null,
                peers: torrent.peersSendingToUs ?? null,
                peersTotal: torrent.peersConnected ?? null,
                piecesTotal: torrent.pieceCount ?? null,
                totalSize: torrent.totalSize ?? null,
                uploadSpeed: torrent.rateUpload ?? null,
                isPrivate: torrent.isPrivate ?? null,
                errorString: torrent.errorString ?? null,
                queuePosition: torrent.queuePosition ?? null,
                sequentialDownload: torrent.sequentialDownload ?? torrent.sequential_download ?? null,
            },
            files: files.map((file: any, index: number) => {
                const stats = fileStats[index] || {}
                const size = typeof file.length === 'number' ? file.length : (parseInt(String(file.length), 10) || 0)
                const completed = typeof stats.bytesCompleted === 'number'
                    ? stats.bytesCompleted
                    : (typeof file.bytesCompleted === 'number' ? file.bytesCompleted : 0)
                const priority = stats.priority != null
                    ? Number(stats.priority)
                    : (priorities[index] != null ? Number(priorities[index]) : undefined)

                return {
                    index,
                    path: file.name || '',
                    name: (file.name || '').split(/[/\\]/).pop() || '',
                    size,
                    progress: size > 0 ? Math.max(0, Math.min(1, completed / size)) : 0,
                    priority,
                    wanted: Boolean(stats.wanted ?? wanted[index] ?? true),
                }
            }),
        }
    }

    private removeEmpty(obj: Record<string, any>) {
        return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== null && value !== undefined))
    }

    private ensureSuccess(response: any) {
        const data = response?.data

        if (data?.result === 'success') {
            return response
        }

        if (data?.error) {
            throw new Error(data.error.data?.error_string || data.error.message || 'Transmission request failed')
        }

        return response
    }

    private getUploadOptions(uploadOptions?: Record<string, any>) {
        if (!uploadOptions) {
            return {}
        }

        return this.removeEmpty({
            'download-dir': uploadOptions.saveLocation || undefined,
            labels: uploadOptions.category ? [uploadOptions.category] : undefined,
            paused: uploadOptions.startTorrent === undefined ? undefined : !uploadOptions.startTorrent,
        })
    }

    private getPostAddUploadOptions(uploadOptions?: Record<string, any>) {
        if (!uploadOptions) {
            return {}
        }

        const downloadLimit = uploadOptions.downloadSpeedLimit
        const uploadLimit = uploadOptions.uploadSpeedLimit

        return this.removeEmpty({
            'peer-limit': uploadOptions.peerLimit,
            sequentialDownload: uploadOptions.sequentialDownload,
            sequential_download: uploadOptions.sequentialDownload,
            downloadLimit,
            downloadLimited: downloadLimit === undefined ? undefined : true,
            uploadLimit,
            uploadLimited: uploadLimit === undefined ? undefined : true,
        })
    }

    private getAddedTorrentId(response: any) {
        const added = response?.data?.arguments?.['torrent-added']
            || response?.data?.arguments?.torrent_added

        return typeof added?.id === 'number' ? added.id : null
    }

    private async addTorrent(argumentsData: Record<string, any>, uploadOptions?: Record<string, any>) {
        const response = await this.getHttpClient().post(this.url(), {
            arguments: {
                ...argumentsData,
                ...this.getUploadOptions(uploadOptions),
            },
            method: 'torrent-add',
        }, {})

        if ('torrent-duplicate' in response.data.arguments) {
            throw new Error('Could not add duplicate torrent to transmission')
        }
        if (response.data.result !== 'success') {
            throw new Error(`Could not add torrent to transmission: ${response.data.result}`)
        }

        const postAddOptions = this.getPostAddUploadOptions(uploadOptions)
        const addedTorrentId = this.getAddedTorrentId(response)
        if (Object.keys(postAddOptions).length === 0) {
            return
        }
        if (addedTorrentId == null) {
            throw new Error('Transmission did not return the added torrent id')
        }

        await this.doAction('torrent-set', [], {
            ids: [addedTorrentId],
            ...postAddOptions,
        }).then((setResponse) => this.ensureSuccess(setResponse)).then(() => undefined)
    }

    async addTorrentUrl(uri: string, uploadOptions?: Record<string, any>): Promise<void> {
        await this.addTorrent({
            filename: uri,
        }, uploadOptions)
    }

    async uploadTorrent(buffer: Uint8Array, _filename: string, uploadOptions?: Record<string, any>): Promise<void> {
        await this.addTorrent({
            metainfo: Buffer.from(buffer).toString('base64'),
        }, uploadOptions)
    }

    private doAction(command: string, hashes: string[], mutator?: string | Record<string, any>, value?: any) {
        const data: Record<string, any> = {
            arguments: { ids: null },
            method: command,
        }

        if (hashes.length) {
            data.arguments.ids = hashes
        }

        if (typeof mutator === 'string') {
            data.arguments[mutator] = value
        } else if (mutator && typeof mutator === 'object') {
            Object.assign(data.arguments, mutator)
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

    setLocation(hashes: string[], location: string): Promise<void> {
        return this.doAction('torrent-set-location', hashes, {
            location,
            move: true,
        }).then((response) => this.ensureSuccess(response)).then(() => undefined)
    }

    label(hashes: string[], label: string): Promise<void> {
        return this.doAction('torrent-set', hashes, {
            labels: [label],
        }).then((response) => this.ensureSuccess(response)).then(() => undefined)
    }

    setSpeedLimits(hashes: string[], options: Record<string, any>): Promise<void> {
        const args = this.removeEmpty({
            downloadLimit: options.downloadSpeedLimit,
            downloadLimited: options.downloadSpeedLimit === undefined ? undefined : options.downloadSpeedLimit > 0,
            uploadLimit: options.uploadSpeedLimit,
            uploadLimited: options.uploadSpeedLimit === undefined ? undefined : options.uploadSpeedLimit > 0,
        })

        return this.doAction('torrent-set', hashes, args).then((response) => this.ensureSuccess(response)).then(() => undefined)
    }

    setRatioLimit(hashes: string[], options: Record<string, any>): Promise<void> {
        return this.doAction('torrent-set', hashes, {
            seedRatioMode: 1,
            seedRatioLimit: Number(options.ratioLimit),
        }).then((response) => this.ensureSuccess(response)).then(() => undefined)
    }
}
