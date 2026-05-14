import { dialog } from 'electron'

const path = require('path')
const fs = require('fs')

const electorrent = require('./electorrent')
const { IPC_CHANNELS } = require('../../shared/ipc')

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

function serializeTorrentFile(filePath: string, askUploadOptions: boolean) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err: Error | null, data: Buffer) => {
            if (err) {
                reject(err)
                return
            }

            resolve({
                type: 'file',
                filename: path.basename(filePath),
                data: new Uint8Array(data),
                askUploadOptions: !!askUploadOptions,
            })
        })
    })
}

async function readFiles(filepaths: string[], askUploadOptions: boolean) {
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

async function browse(askUploadOptions: boolean) {
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

exports.browse = browse
exports.readFiles = readFiles
