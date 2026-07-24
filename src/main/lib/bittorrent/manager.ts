import fs from "fs"
import path from "path"
import type { WebContents } from "electron"
import { lookup as lookupCountry } from "geoip-country"
import type {
    BittorrentAddTorrentUrlRequest,
    BittorrentInvokeActionRequest,
    BittorrentServerConfig,
    BittorrentSetTorrentFileSelectionRequest,
    TorrentClientConnection,
    BittorrentTorrentDetailsData,
    BittorrentTorrentDetailsFile,
    BittorrentTorrentPeer,
    BittorrentTorrentDetailsTracker,
    BittorrentUploadTorrentRequest,
} from "@shared/ipc-contract"
import logger from "../logger"
import * as settings from "../settings"
import { createRuntime } from "./registry"
import type { BittorrentRuntime } from "./types"
import { withTorrentActionAccelerators } from "@shared/torrent-actions"

export interface BittorrentSessionState {
    activeServerId: string | null
    activeClientId: string | null
    isConnected: boolean
    selectedTorrentCount: number
    actions: ReturnType<typeof withTorrentActionAccelerators>
}

const EMPTY_SESSION_STATE: BittorrentSessionState = {
    activeServerId: null,
    activeClientId: null,
    isConnected: false,
    selectedTorrentCount: 0,
    actions: [],
}

class BittorrentManager {
    private sessions = new Map<number, BittorrentRuntime>()
    private pendingConnections = new Map<number, Promise<TorrentClientConnection>>()
    private sessionStates = new Map<number, BittorrentSessionState>()
    private sessionListeners = new Set<() => void>()

    private async getSession(sender: WebContents) {
        const senderId = sender.id
        const session = this.sessions.get(senderId)
        if (session) {
            return session
        }

        const pending = this.pendingConnections.get(senderId)
        if (pending) {
            await pending
        }

        const connectedSession = this.sessions.get(senderId)
        if (connectedSession) {
            return connectedSession
        }

        throw new Error("No active bittorrent session")
    }

    private canAutoRemoveUploadedTorrent(request: BittorrentUploadTorrentRequest) {
        if (!request.sourcePath) {
            return false
        }

        const filename = typeof request.filename === "string" ? request.filename : ""
        if (!filename || filename !== path.basename(filename) || !filename.toLowerCase().endsWith(".torrent")) {
            return false
        }

        const sourceBasename = path.basename(request.sourcePath)
        return sourceBasename === filename && sourceBasename.toLowerCase().endsWith(".torrent")
    }

    async connect(sender: WebContents, server: BittorrentServerConfig) {
        const senderId = sender.id
        this.setSessionState(senderId, {
            activeServerId: server.id || null,
            activeClientId: server.client || null,
            isConnected: false,
            selectedTorrentCount: 0,
            actions: [],
        })
        const pendingConnect = (async () => {
            const existing = this.sessions.get(senderId)
            if (existing) {
                if (typeof existing.disconnect === "function") {
                    await existing.disconnect()
                }
                this.sessions.delete(senderId)
            }

            const runtime = createRuntime(server.client)
            const connection = await runtime.connect(server)
            if (this.pendingConnections.get(senderId) !== pendingConnect) {
                if (typeof runtime.disconnect === "function") {
                    await runtime.disconnect()
                }
                throw new Error("Stale bittorrent connection")
            }
            this.sessions.set(senderId, runtime)
            this.setSessionState(senderId, {
                activeServerId: server.id || null,
                activeClientId: server.client || null,
                isConnected: true,
                selectedTorrentCount: 0,
                actions: withTorrentActionAccelerators(runtime.actions),
            })
            return connection
        })()

        this.pendingConnections.set(senderId, pendingConnect)
        try {
            return await pendingConnect
        } finally {
            if (this.pendingConnections.get(senderId) === pendingConnect) {
                this.pendingConnections.delete(senderId)
            }
        }
    }

    async disconnect(sender: WebContents): Promise<void> {
        const senderId = sender.id
        const pending = this.pendingConnections.get(senderId)
        if (pending) {
            await pending.catch(() => undefined)
        }

        const existing = this.sessions.get(senderId)
        if (!existing) {
            this.setSessionState(senderId, EMPTY_SESSION_STATE)
            return
        }
        if (typeof existing.disconnect === "function") {
            await existing.disconnect()
        }
        this.sessions.delete(senderId)
        this.setSessionState(senderId, EMPTY_SESSION_STATE)
    }

    async getSnapshot(sender: WebContents, fullUpdate?: boolean) {
        const session = await this.getSession(sender)
        return session.getSnapshot(fullUpdate)
    }

    async addTorrentUrl(sender: WebContents, request: BittorrentAddTorrentUrlRequest) {
        const session = await this.getSession(sender)
        return session.addTorrentUrl(request.uri, request.options)
    }

    async uploadTorrent(sender: WebContents, request: BittorrentUploadTorrentRequest) {
        const session = await this.getSession(sender)
        await session.uploadTorrent(request.data, request.filename, request.options)

        if (settings.getAllSettings().autoRemoveTorrents !== true || !this.canAutoRemoveUploadedTorrent(request)) {
            return
        }

        try {
            await fs.promises.unlink(request.sourcePath)
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                return
            }

            logger.error("Failed to delete uploaded torrent file", {
                filePath: request.sourcePath,
                error,
            })
        }
    }

    async invokeAction(sender: WebContents, request: BittorrentInvokeActionRequest) {
        const runtime = await this.getSession(sender)
        const action = (runtime as unknown as Record<string, unknown>)[request.action]
        if (typeof action !== "function") {
            throw new Error(`Unsupported bittorrent action: ${request.action}`)
        }
        return action.call(runtime, request.ids || [], ...(request.args || []))
    }

    async getActions(sender: WebContents) {
        const runtime = await this.getSession(sender)
        return withTorrentActionAccelerators(runtime.actions)
    }

    setSelectedTorrents(sender: WebContents, ids: unknown) {
        const state = this.getSessionState(sender)
        if (!state.isConnected) return
        const selectedTorrentCount = Array.isArray(ids)
            ? new Set(ids.filter((id): id is string => typeof id === "string")).size
            : 0
        if (selectedTorrentCount === state.selectedTorrentCount) return
        this.setSessionState(sender.id, { ...state, selectedTorrentCount })
    }

    async getTorrentDetails(sender: WebContents, id: string): Promise<BittorrentTorrentDetailsData> {
        const runtime = await this.getSession(sender)
        if (typeof runtime.getTorrentDetails !== "function") {
            throw new Error("Torrent details not supported for this client")
        }
        return runtime.getTorrentDetails(id)
    }

    async getTorrentFiles(sender: WebContents, id: string): Promise<BittorrentTorrentDetailsFile[]> {
        const runtime = await this.getSession(sender)
        if (typeof runtime.getTorrentFiles !== "function") {
            throw new Error("Torrent files not supported for this client")
        }
        return runtime.getTorrentFiles(id)
    }

    async getTorrentPeers(sender: WebContents, id: string): Promise<BittorrentTorrentPeer[]> {
        const runtime = await this.getSession(sender)
        if (typeof runtime.getTorrentPeers !== "function") {
            throw new Error("Torrent peers not supported for this client")
        }

        const peers = await runtime.getTorrentPeers(id)
        return peers.map((peer) => {
            if (peer.countryCode && peer.country) {
                return peer
            }

            const geo = lookupCountry(peer.ip)
            return geo ? { ...peer, countryCode: geo.country, country: geo.name } : peer
        })
    }

    async getTorrentTrackers(sender: WebContents, id: string): Promise<BittorrentTorrentDetailsTracker[]> {
        const runtime = await this.getSession(sender)
        if (typeof runtime.getTorrentTrackers !== "function") {
            throw new Error("Torrent trackers not supported for this client")
        }
        return runtime.getTorrentTrackers(id)
    }

    async setTorrentFileSelection(sender: WebContents, request: BittorrentSetTorrentFileSelectionRequest) {
        const runtime = await this.getSession(sender)
        if (typeof runtime.setTorrentFileSelection !== "function") {
            throw new Error("Torrent file selection not supported for this client")
        }
        return runtime.setTorrentFileSelection(request.id, request.files)
    }

    disconnectWindow(sender: WebContents | null | undefined) {
        if (!sender) {
            return Promise.resolve()
        }
        return this.disconnect(sender)
    }

    hasSession(sender: WebContents | null | undefined) {
        if (!sender) {
            return false
        }

        return this.sessions.has(sender.id)
    }

    getSessionState(sender: Pick<WebContents, "id"> | null | undefined): BittorrentSessionState {
        if (!sender) return EMPTY_SESSION_STATE
        return this.sessionStates.get(sender.id) || EMPTY_SESSION_STATE
    }

    subscribe(listener: () => void) {
        this.sessionListeners.add(listener)
        return () => this.sessionListeners.delete(listener)
    }

    private setSessionState(senderId: number, state: BittorrentSessionState) {
        if (state.activeServerId) {
            this.sessionStates.set(senderId, state)
        } else {
            this.sessionStates.delete(senderId)
        }
        this.sessionListeners.forEach((listener) => listener())
    }
}

export const bittorrentManager = new BittorrentManager()
