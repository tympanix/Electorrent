import type { WebContents } from "electron"
import type {
    BittorrentAddTorrentUrlRequest,
    BittorrentInvokeActionRequest,
    BittorrentServerConfig,
    BittorrentSetTorrentFileSelectionRequest,
    BittorrentUploadTorrentRequest,
} from "../../../shared/ipc-contract"
import { createRuntime } from "./registry"
import type { BittorrentRuntime } from "./types"

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
