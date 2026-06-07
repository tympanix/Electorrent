import fs from "fs"
import path from "path"
import type { WebContents } from "electron"
import type {
    BittorrentAddTorrentUrlRequest,
    BittorrentInvokeActionRequest,
    BittorrentServerConfig,
    BittorrentSetTorrentFileSelectionRequest,
    BittorrentTorrentDetailsData,
    BittorrentUploadTorrentRequest,
} from "@shared/ipc-contract"
import logger from "../logger"
import * as settings from "../settings"
import { createRuntime } from "./registry"
import type { BittorrentRuntime } from "./types"

class BittorrentManager {
    private sessions = new Map<number, BittorrentRuntime>()
    private pendingConnections = new Map<number, Promise<void>>()

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

    async connect(sender: WebContents, server: BittorrentServerConfig): Promise<void> {
        const senderId = sender.id
        const pendingConnect = (async () => {
            const existing = this.sessions.get(senderId)
            if (existing) {
                if (typeof existing.disconnect === "function") {
                    await existing.disconnect()
                }
                this.sessions.delete(senderId)
            }

            const runtime = createRuntime(server.client)
            await runtime.connect(server)
            this.sessions.set(senderId, runtime)
        })()

        this.pendingConnections.set(senderId, pendingConnect)
        try {
            await pendingConnect
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
            return
        }
        if (typeof existing.disconnect === "function") {
            await existing.disconnect()
        }
        this.sessions.delete(senderId)
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
        const action = runtime[request.action]
        if (typeof action !== "function") {
            throw new Error(`Unsupported bittorrent action: ${request.action}`)
        }
        return action.call(runtime, request.hashes || [], ...(request.args || []))
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
}

export const bittorrentManager = new BittorrentManager()
