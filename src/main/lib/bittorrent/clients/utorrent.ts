import axios, { AxiosInstance } from 'axios'
import httpAdapter from 'axios/lib/adapters/http.js'
import FormData from 'form-data'
import qs from 'qs'

import type { BittorrentServerConfig } from '../../../../shared/ipc-contract'
import { createHttpsAgent, serverUrl } from '../helpers'
import type { BittorrentRuntime } from '../types'

export class UtorrentRuntime implements BittorrentRuntime {
    private server!: BittorrentServerConfig
    private http!: AxiosInstance
    private data = {
        url: '',
        username: '',
        password: '',
        token: '',
        cid: 0,
        build: -1,
    }

    private url(pathValue = '') {
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
            paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'repeat' }),
            adapter: httpAdapter,
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

        const res = await this.http.get(`${this.url()}/token.html`, {
            timeout: 5000,
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

        this.saveConnection(serverUrl(server), server.user, server.password)
    }

    addTorrentUrl(uri: string, options?: Record<string, any>): Promise<void> {
        return this.http.get(`${this.data.url}/`, {
            params: {
                token: this.data.token,
                t: Date.now(),
                action: 'add-url',
                s: uri,
                download_dir: options?.saveLocation || 0,
                path: '',
            },
        }).then(() => undefined)
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

        await this.http.post(`${this.data.url}/`, formData, {
            params: {
                token: this.data.token,
                action: 'add-file',
                download_dir: options?.saveLocation || 0,
                path: '',
            },
            headers: {
                ...formData.getHeaders(),
                'Content-Length': contentLength.toString(),
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
        return this.http.get(`${this.data.url}/`, {
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
}
