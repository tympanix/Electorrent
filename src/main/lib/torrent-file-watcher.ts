import fs, { type FSWatcher } from 'fs'
import path from 'path'

import { Notification, type BrowserWindow } from 'electron'

import { bittorrentManager } from '@main/lib/bittorrent'
import { IPC_CHANNELS } from '@shared/ipc'
import type { AppSettings, PendingTorrentUploadFile } from '@shared/ipc-contract'
import logger from './logger'
import { serializeTorrentFile } from './torrents'

interface TorrentFileWatcherOptions {
    getSettings: () => Pick<AppSettings, 'watchDirectory' | 'alwaysPromptUploadOptions'>
    getWindow: () => BrowserWindow | null
    isHeadless: boolean
    isRendererLoaded: () => boolean
    showOrCreateTorrentWindow: () => void
    showTorrentWindow: () => void
}

export class TorrentFileWatcher {
    private watcher: FSWatcher | null = null
    private watchedDirectory = ''
    private pendingFiles = new Map<string, NodeJS.Timeout>()
    private processedFiles = new Map<string, string>()
    private pendingPromptedTorrentFiles: PendingTorrentUploadFile[] = []
    private pendingSilentWatcherFiles: PendingTorrentUploadFile[] = []

    constructor(private readonly options: TorrentFileWatcherOptions) {}

    start() {
        this.refresh()
    }

    refresh() {
        const settings = this.options.getSettings()
        const nextDirectory = typeof settings.watchDirectory === 'string'
            ? settings.watchDirectory.trim()
            : ''

        if (nextDirectory === this.watchedDirectory) {
            return
        }

        this.stop()

        if (!nextDirectory) {
            return
        }

        try {
            this.watcher = fs.watch(nextDirectory, { recursive: false }, (_eventType, filename) => {
                if (typeof filename !== 'string' || !filename.endsWith('.torrent')) {
                    return
                }

                const filePath = path.join(nextDirectory, filename)
                const pending = this.pendingFiles.get(filePath)
                if (pending) {
                    clearTimeout(pending)
                }

                this.pendingFiles.set(filePath, setTimeout(() => {
                    this.pendingFiles.delete(filePath)
                    void this.processFile(filePath)
                }, 500))
            })
            this.watchedDirectory = nextDirectory
            logger.info('Watching torrent directory', nextDirectory)
        } catch (error) {
            logger.error('Failed to watch torrent directory', {
                directory: nextDirectory,
                error,
            })
        }
    }

    stop() {
        this.watchedDirectory = ''

        for (const pending of this.pendingFiles.values()) {
            clearTimeout(pending)
        }

        this.pendingFiles.clear()
        this.processedFiles.clear()

        if (this.watcher) {
            this.watcher.close()
            this.watcher = null
        }
    }

    consumePendingPromptedTorrentFiles() {
        return this.pendingPromptedTorrentFiles.splice(0).map((file) => this.clonePendingTorrentFile(file))
    }

    async flushPendingSilentWatcherFiles() {
        const window = this.options.getWindow()
        if (!window || window.isDestroyed() || !bittorrentManager.hasSession(window.webContents)) {
            return
        }

        while (this.pendingSilentWatcherFiles.length > 0) {
            const file = this.pendingSilentWatcherFiles.shift()
            if (!file) {
                continue
            }
            await this.uploadWatchedTorrentSilently(file)
        }
    }

    private async processFile(filePath: string) {
        const settings = this.options.getSettings()
        const askUploadOptions = settings.alwaysPromptUploadOptions === true

        try {
            const file = await serializeTorrentFile(filePath, askUploadOptions)
            const stats = await fs.promises.stat(filePath)

            if (!stats.isFile()) {
                return
            }

            const signature = `${stats.mtimeMs}:${stats.size}`
            if (this.processedFiles.get(filePath) === signature) {
                return
            }

            this.processedFiles.set(filePath, signature)
            await this.handleTorrentFile(file)
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return
            }

            logger.error('Failed to process watched torrent file', {
                filePath,
                error,
            })
        }
    }

    private clonePendingTorrentFile(file: PendingTorrentUploadFile): PendingTorrentUploadFile {
        return {
            type: 'file',
            filename: file.filename,
            data: new Uint8Array(file.data),
            sourcePath: file.sourcePath,
            askUploadOptions: !!file.askUploadOptions,
        }
    }

    private showNativeNotification(title: string, body: string) {
        if (this.options.isHeadless || !Notification.isSupported()) {
            return
        }

        try {
            new Notification({ title, body }).show()
        } catch (error) {
            logger.error('Failed to show native notification', { title, body, error })
        }
    }

    private queuePendingPromptedTorrentFiles(files: PendingTorrentUploadFile[]) {
        this.pendingPromptedTorrentFiles.push(...files.map((file) => this.clonePendingTorrentFile(file)))
    }

    private async handleTorrentFile(file: PendingTorrentUploadFile) {
        if (file.askUploadOptions) {
            this.deliverPromptedTorrentFiles([file])
            return
        }

        await this.uploadWatchedTorrentSilently(file)
    }

    private deliverPromptedTorrentFiles(files: PendingTorrentUploadFile[]) {
        if (files.length === 0) {
            return
        }

        const window = this.options.getWindow()
        if (!this.options.isRendererLoaded() || !window || window.isDestroyed()) {
            this.queuePendingPromptedTorrentFiles(files)
            this.options.showOrCreateTorrentWindow()
            return
        }

        this.options.showTorrentWindow()
        window.webContents.send(IPC_CHANNELS.launch.torrentFiles, files.map((file) => this.clonePendingTorrentFile(file)))
    }

    private async uploadWatchedTorrentSilently(file: PendingTorrentUploadFile) {
        const window = this.options.getWindow()

        if (!window || window.isDestroyed() || !bittorrentManager.hasSession(window.webContents)) {
            this.pendingSilentWatcherFiles.push(this.clonePendingTorrentFile(file))
            return
        }

        try {
            await bittorrentManager.uploadTorrent(window.webContents, {
                data: file.data,
                filename: file.filename,
                sourcePath: file.sourcePath,
            })
            this.showNativeNotification('Torrent added', `${file.filename} is downloading in Electorrent`)
        } catch (error) {
            logger.error('Failed to upload watched torrent file', {
                filename: file.filename,
                error,
            })
            this.showNativeNotification('Torrent add failed', `Could not add ${file.filename}`)
        }
    }
}
