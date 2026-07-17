import fs from "fs"
import path from "path"
import type { WebContents } from "electron"
import type {
    BittorrentAddTorrentUrlRequest,
    BittorrentServerConfig,
    BittorrentSetTorrentFileSelectionRequest,
    TorrentClientConnection,
    BittorrentTorrentDetailsData,
    BittorrentUploadTorrentRequest,
} from "@shared/ipc-contract"
import {
    isBittorrentActionName,
    type BittorrentActionName,
    type BittorrentInvokeActionRequest,
} from "@shared/bittorrent-actions"
import logger from "../logger"
import * as settings from "../settings"
import { createRuntime } from "./registry"
import type { BittorrentRuntime, BittorrentRuntimeAction } from "./types"

function getRuntimeAction<Action extends BittorrentActionName>(
    runtime: BittorrentRuntime,
    action: Action,
): BittorrentRuntimeAction<Action> | undefined {
    return runtime[action] as BittorrentRuntimeAction<Action> | undefined
}

export interface BittorrentSessionState {
    activeServerId: string | null
    activeClientId: string | null
    isConnected: boolean
}

const EMPTY_SESSION_STATE: BittorrentSessionState = {
    activeServerId: null,
    activeClientId: null,
    isConnected: false,
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

    async invokeAction(sender: WebContents, request: BittorrentInvokeActionRequest | null | undefined) {
        if (!request || typeof request !== "object") {
            throw new Error("Invalid bittorrent action request")
        }

        const { action, hashes, args } = request
        if (!isBittorrentActionName(action)) {
            throw new Error(`Unsupported bittorrent action: ${action}`)
        }
        if (hashes !== undefined && !Array.isArray(hashes)) {
            throw new Error("Invalid bittorrent action hashes")
        }
        if (args !== undefined && !Array.isArray(args)) {
            throw new Error("Invalid bittorrent action arguments")
        }

        const runtime = await this.getSession(sender)
        const runtimeAction = getRuntimeAction(runtime, action)
        if (typeof runtimeAction !== "function") {
            throw new Error(`Unsupported bittorrent action: ${action}`)
        }
        return runtimeAction.call(runtime, hashes || [], ...(args || []))
    }

    async getTorrentDetails(sender: WebContents, hash: string): Promise<BittorrentTorrentDetailsData> {
        const runtime = await this.getSession(sender)
        if (typeof runtime.getTorrentDetails !== "function") {
            throw new Error("Torrent details not supported for this client")
        }
        return runtime.getTorrentDetails(hash)
    }

    async getTorrentFiles(sender: WebContents, hash: string) {
        const runtime = await this.getSession(sender)
        if (typeof runtime.getTorrentFiles !== "function") {
            throw new Error("Torrent file selection not supported for this client")
        }
        return runtime.getTorrentFiles(hash)
    }

    async setTorrentFileSelection(sender: WebContents, request: BittorrentSetTorrentFileSelectionRequest) {
        const runtime = await this.getSession(sender)
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
