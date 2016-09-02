// Imports
const electron = require('electron');
const path = require('path');
const request = require('request');
const fs = require('fs');

// Custom imports
const logger = require('./logger');
const electorrent = require('./electorrent');

// Electron modules
const {app} = electron;
const {ipcMain} = electron;
const {autoUpdater} = electron;
const {shell} = electron;
const {dialog} = electron;
const {BrowserWindow} = electron;

const win = BrowserWindow.getFocusedWindow();

function notify({ title = '', message = '', type = 'info'}) {
    var win = electorrent.getWindow();
    if (!win) return;

    win.webContents.send('notify', {
        title: title,
        message: message,
        type: type
    });
}

function browse(paths){

    if (paths) {
        processFiles(paths);
        return;
    }

    dialog.showOpenDialog(win, {
        title: 'Open Torrent File',
        buttonLabel: 'Add Torrent',
        filters: [
            {name: 'Torrent', extensions: ['torrent']}
        ],
        properties: ['openFile', 'multiSelections']
    }, processFiles)
}

function processFiles(filepaths) {
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

            win.webContents.send('torrentfiles', data, path.basename(file));

        });
    })
}

function filterFiles(path){
    return path.endsWith('.torrent');
}

module.exports = browse;
