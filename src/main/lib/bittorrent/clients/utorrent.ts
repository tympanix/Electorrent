import { URL } from 'node:url'
import axios, { AxiosInstance } from 'axios'
import httpAdapter from 'axios/lib/adapters/http.js'
import FormData from 'form-data'
import https from 'https'
import qs from 'qs'

import type { BittorrentServerConfig, TorrentClientConnection } from '@shared/ipc-contract'
import {
    HTTP_LOGIN_TIMEOUT,
    HTTP_REQUEST_TIMEOUT,
    serverUrl,
} from '@main/lib/bittorrent/helpers'
import type { BittorrentRuntime } from '@main/lib/bittorrent/types'

export class UtorrentRuntime implements BittorrentRuntime {
    private server!: BittorrentServerConfig
    private http!: AxiosInstance
    private data = {
        username: '',
        password: '',
        token: '',
        cid: 0,
        build: -1,
    }

    private url(endpoint = '') {
        const url = new URL(serverUrl(this.server, endpoint || undefined))
        if (!endpoint) {
            url.pathname = `${url.pathname.replace(/\/?$/, '')}/`
        }

        return url.toString()
    }

    private saveConnection(username: string, password: string) {
        this.data.username = username
        this.data.password = password
    }

    private extractTokenFromHTML(str: string) {
        const match = str.match(/>([^<]+)</)
        if (match) {
            this.data.token = match[match.length - 1]
            return true
        }
        return false
    }

    private normalizePath(pathValue: string) {
        return pathValue.replace(/\\/g, '/').replace(/\/+$/, '')
    }

    private async getUploadLocationParams(options?: Record<string, any>) {
        if (!options?.saveLocation) {
            return {
                download_dir: 0,
                path: '',
            }
        }

        const res = await this.http.get(this.url(), {
            params: {
                token: this.data.token,
                t: Date.now(),
                action: 'list-dirs',
            },
        })

        const saveLocation = this.normalizePath(options.saveLocation)
        const downloadDirs = Array.isArray(res.data?.['download-dirs']) ? res.data['download-dirs'] : []
        const matchingDir = downloadDirs
            .map((entry: { path?: string }, index: number) => ({
                index,
                path: typeof entry?.path === 'string' ? this.normalizePath(entry.path) : '',
            }))
            .filter((entry) => entry.index > 0 && entry.path && saveLocation.startsWith(`${entry.path}/`))
            .sort((left, right) => right.path.length - left.path.length)[0]

        if (!matchingDir) {
            throw new Error(`uTorrent save location is outside configured download directories: ${options.saveLocation}`)
        }

        return {
            download_dir: matchingDir.index,
            path: saveLocation.slice(matchingDir.path.length + 1),
        }
    }

    async connect(server: BittorrentServerConfig): Promise<TorrentClientConnection> {
        this.server = server

        this.http = axios.create({
            auth: {
                username: server.user,
                password: server.password,
            },
            httpsAgent: new https.Agent({
                ca: server.certificateData ? Buffer.from(server.certificateData) : undefined,
                rejectUnauthorized: server.tlsSecurity !== "insecure",
            }),
            paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'repeat' }),
            adapter: httpAdapter,
            timeout: HTTP_REQUEST_TIMEOUT,
        })

        this.http.interceptors.response.use((res) => {
            if (res.data && res.data.torrentc !== undefined) {
                this.data.cid = res.data.torrentc
            }
            return res
        })

        this.http.interceptors.response.use((res) => {
            const cookie = res.headers['set-cookie']
            if (cookie && cookie.length) {
                this.http.defaults.headers.common.Cookie = cookie[0]
            }
            return res
        })

        this.http.interceptors.response.use((res) => {
            const error = res?.data?.error
            if (typeof error === 'string') {
                throw new Error(error)
            }
            return res
        })

        const res = await this.http.get(this.url('token.html'), {
            timeout: HTTP_LOGIN_TIMEOUT,
            params: {
                t: Date.now(),
            },
        })

        if (res.status === 401 || res.status === 402) {
            throw new Error('Invalid credentials')
        }
        if (res.status !== 200) {
            throw new Error('Invalid information provided to server')
        }
        if (!this.extractTokenFromHTML(res.data)) {
            throw new Error('Failed to authenticate with server')
        }

        this.saveConnection(server.user, server.password)

        const versionResponse = await this.http.get(this.url(), {
            params: {
                token: this.data.token,
                t: Date.now(),
                list: 1,
            },
        })
        const build = versionResponse.data?.build
        if ((typeof build !== 'string' && typeof build !== 'number') || !String(build).trim()) {
            throw new Error('µTorrent did not return its build version')
        }

        return {
            version: String(build).trim(),
            features: {
                magnetLinks: true,
                labels: true,
                speedLimits: true,
                ratioLimits: false,
                uploadOptions: {
                    saveLocation: true,
                },
            },
        }
    }

    async addTorrentUrl(uri: string, options?: Record<string, any>): Promise<void> {
        const uploadLocation = await this.getUploadLocationParams(options)

        await this.http.get(this.url(), {
            params: {
                token: this.data.token,
                t: Date.now(),
                action: 'add-url',
                s: uri,
                ...uploadLocation,
            },
        })
    }

    async uploadTorrent(buffer: Uint8Array, filename?: string, options?: Record<string, any>): Promise<void> {
        const formData = new FormData()
        formData.append('torrent_file', Buffer.from(buffer), {
            filename: filename || 'upload.torrent',
            contentType: 'application/x-bittorrent',
        })

        const contentLength = await new Promise<number>((resolve, reject) => {
            formData.getLength((err, length) => err ? reject(err) : resolve(length))
        })
        const uploadLocation = await this.getUploadLocationParams(options)

        await this.http.post(this.url(), formData, {
            params: {
                token: this.data.token,
                action: 'add-file',
                ...uploadLocation,
            },
            headers: {
                ...formData.getHeaders(),
                'Content-Length': contentLength.toString(),
            },
        })
    }

    async getSnapshot(): Promise<any> {
        const res = await this.http.get(this.url(), {
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
        return this.http.get(this.url(), {
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
        return this.doAction('start', hashes)
    }

    stop(hashes: string[]): Promise<void> {
        return this.doAction('stop', hashes)
    }

    pause(hashes: string[]): Promise<void> {
        return this.doAction('pause', hashes)
    }

    remove(hashes: string[]): Promise<void> {
        return this.doAction('remove', hashes)
    }

    removedata(hashes: string[]): Promise<void> {
        return this.doAction('removedata', hashes)
    }

    removetorrent(hashes: string[]): Promise<void> {
        return this.doAction('removetorrent', hashes)
    }

    removedatatorrent(hashes: string[]): Promise<void> {
        return this.doAction('removedatatorrent', hashes)
    }

    forcestart(hashes: string[]): Promise<void> {
        return this.doAction('forcestart', hashes)
    }

    recheck(hashes: string[]): Promise<void> {
        return this.doAction('recheck', hashes)
    }

    queueup(hashes: string[]): Promise<void> {
        return this.doAction('queueup', hashes)
    }

    queuedown(hashes: string[]): Promise<void> {
        return this.doAction('queuedown', hashes)
    }

    getprops(hashes: string[]): Promise<void> {
        return this.doAction('getprops', hashes)
    }

    setLabel(hashes: string[], label: string): Promise<void> {
        return this.http.get(this.url(), {
            params: {
                token: this.data.token,
                hash: hashes,
                s: 'label',
                v: label,
                action: 'setprops',
                t: Date.now(),
            },
        }).then(() => undefined)
    }

    private setProperty(hashes: string[], property: string, value: number): Promise<void> {
        return this.http.get(this.url(), {
            params: {
                token: this.data.token,
                hash: hashes,
                s: property,
                v: value,
                action: 'setprops',
                t: Date.now(),
            },
        }).then(() => undefined)
    }

    async setSpeedLimits(hashes: string[], options: Record<string, any>): Promise<void> {
        const requests: Promise<void>[] = []
        if (options.downloadSpeedLimit !== undefined) {
            requests.push(this.setProperty(hashes, 'dlrate', Number(options.downloadSpeedLimit)))
        }
        if (options.uploadSpeedLimit !== undefined) {
            requests.push(this.setProperty(hashes, 'ulrate', Number(options.uploadSpeedLimit)))
        }
        await Promise.all(requests)
    }

    async setRatioLimit(hashes: string[], options: Record<string, any>): Promise<void> {
        const ratioLimit = Math.round(Number(options.ratioLimit) * 1000)
        await Promise.all([
            this.setProperty(hashes, 'seed_override', 1),
            this.setProperty(hashes, 'seed_ratio', ratioLimit),
        ])
        this.data.cid = 0
    }
}
