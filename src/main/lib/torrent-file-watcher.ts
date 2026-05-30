import fs, { type FSWatcher } from 'fs'
import path from 'path'

import type { AppSettings, PendingTorrentUploadFile } from '@shared/ipc-contract'
import logger from './logger'
import { serializeTorrentFile } from './torrents'

interface TorrentFileWatcherOptions {
    getSettings: () => Pick<AppSettings, 'watchDirectory' | 'alwaysPromptUploadOptions'>
    onTorrentFile: (file: PendingTorrentUploadFile) => void | Promise<void>
}

export class TorrentFileWatcher {
    private watcher: FSWatcher | null = null
    private watchedDirectory = ''
    private pendingFiles = new Map<string, NodeJS.Timeout>()
    private processedFiles = new Map<string, string>()

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
            await this.options.onTorrentFile(file)
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
}
