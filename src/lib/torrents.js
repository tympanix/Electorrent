// Imports
const electron = require('electron');
const path = require('path');
const fs = require('fs');

// Custom imports
const electorrent = require('./electorrent');

// Electron modules
const {dialog} = electron;

function notify({ title = '', message = '', type = 'info'}) {
    var win = electorrent.getWindow();
    if (!win) return;

    win.webContents.send('notify', {
        title: title,
        message: message,
        type: type
    });
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

    if (!result.canceled) {
        processFiles(result.filePaths, askUploadOptions)
    }
}

function processFiles(filepaths, askUploadOptions) {
    var win = electorrent.getWindow();

    if (!filepaths) return;

    var torrents = filepaths.filter(filterFiles);

    if (torrents.length === 0) {
        notify({
            title: 'Oopsy Daisy!',
            message: 'Seems like you chose an incorrect file type!',
            type: 'negative'
        })
        return;
    }

    torrents.forEach(function(file){
        fs.readFile(file, (err, data) => {
            if (err) throw err;

            win.webContents.send('torrentfiles', data, path.basename(file), askUploadOptions);

        });
    })
}

function filterFiles(path){
    return path.endsWith('.torrent');
}

exports.browse = browse;
exports.readFiles = processFiles
