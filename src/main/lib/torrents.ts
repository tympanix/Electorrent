import { dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import parseTorrent from 'parse-torrent'

import { IPC_CHANNELS } from '@shared/ipc'
import type {
    ParseTorrentRequest,
    PendingTorrentUploadFile,
    PendingTorrentUploadLink,
    TorrentMetadata,
} from '@shared/ipc-contract'
import * as electorrent from './electorrent'

function notify({ title = '', message = '', type = 'info' }) {
    const win = electorrent.getWindow()
    if (!win) return

    win.webContents.send(IPC_CHANNELS.notifications.push, {
        title,
        message,
        type,
    })
}

function filterFiles(filePath: string) {
    return filePath.endsWith('.torrent')
}

function sleep(timeout: number) {
    return new Promise((resolve) => setTimeout(resolve, timeout))
}

async function waitForStableFile(filePath: string, attempts = 6, delay = 250) {
    let previousSize = -1

    for (let index = 0; index < attempts; index += 1) {
        let stats: fs.Stats

        try {
            stats = await fs.promises.stat(filePath)
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return
            }
            throw error
        }

        if (!stats.isFile()) {
            return
        }

        if (stats.size === previousSize) {
            return
        }

        previousSize = stats.size
        await sleep(delay)
    }
}

export function parse(request: ParseTorrentRequest): TorrentMetadata {
    const source = 'uri' in request ? request.uri : Buffer.from(request.data)
    const parsed = parseTorrent(source)

    return {
        name: parsed.name,
        infoHash: parsed.infoHash,
        length: parsed.length,
        announce: parsed.announce || [],
        files: (parsed.files || []).map((file) => ({
            name: file.name,
            path: file.path,
            length: file.length,
        })),
    }
}

export function serializeMagnetLink(uri: string, askUploadOptions = false): PendingTorrentUploadLink {
    const link: PendingTorrentUploadLink = {
        type: 'link',
        uri,
        askUploadOptions,
    }

    try {
        link.metadata = parse({ uri })
    } catch {
        // Invalid links are still passed through so the client can handle them.
    }

    return link
}

export async function serializeTorrentFile(filePath: string, askUploadOptions: boolean): Promise<PendingTorrentUploadFile> {
    await waitForStableFile(filePath)

    const data = await fs.promises.readFile(filePath)
    const torrentData = new Uint8Array(data)

    return {
        type: 'file',
        filename: path.basename(filePath),
        data: torrentData,
        askUploadOptions: !!askUploadOptions,
        metadata: parse({ data: torrentData }),
    }
}

export async function readFiles(filepaths: string[], askUploadOptions: boolean) {
    if (!Array.isArray(filepaths) || filepaths.length === 0) return []

    const torrents = filepaths.filter(filterFiles)

    if (torrents.length === 0) {
        notify({
            title: 'Oopsy Daisy!',
            message: 'Seems like you chose an incorrect file type!',
            type: 'negative',
        })
        return []
    }

    return Promise.all(torrents.map((file) => serializeTorrentFile(file, askUploadOptions)))
}

export async function browse(askUploadOptions: boolean) {
    const win = electorrent.getWindow()

    const result = await dialog.showOpenDialog(win, {
        title: 'Open Torrent File',
        buttonLabel: 'Add Torrent',
        filters: [
            { name: 'Torrent', extensions: ['torrent'] },
        ],
        properties: ['openFile', 'multiSelections'],
    })

    if (result.canceled) {
        return []
    }

    return readFiles(result.filePaths, askUploadOptions)
}
