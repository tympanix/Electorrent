const electron = require('electron');
const path = require('path');
const fs = require('fs');

const electorrent = require('./electorrent');
const { IPC_CHANNELS } = require('../common/ipc')

const {dialog} = electron;

function notify({ title = '', message = '', type = 'info'}) {
    var win = electorrent.getWindow();
    if (!win) return;

    win.webContents.send(IPC_CHANNELS.notifications.push, {
        title: title,
        message: message,
        type: type
    });
}

function filterFiles(filePath){
    return filePath.endsWith('.torrent');
}

function serializeTorrentFile(filePath, askUploadOptions) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
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

async function readFiles(filepaths, askUploadOptions) {
    if (!filepaths) return [];

    var torrents = filepaths.filter(filterFiles);

    if (torrents.length === 0) {
        notify({
            title: 'Oopsy Daisy!',
            message: 'Seems like you chose an incorrect file type!',
            type: 'negative'
        })
        return [];
    }

    return Promise.all(torrents.map((file) => serializeTorrentFile(file, askUploadOptions)))
}

async function browse(askUploadOptions){
    var win = electorrent.getWindow();

    let result = await dialog.showOpenDialog(win, {
        title: 'Open Torrent File',
        buttonLabel: 'Add Torrent',
        filters: [
            {name: 'Torrent', extensions: ['torrent']}
        ],
        properties: ['openFile', 'multiSelections']
    })

    if (result.canceled) {
        return []
    }

    return readFiles(result.filePaths, askUploadOptions)
}

exports.browse = browse;
exports.readFiles = readFiles
