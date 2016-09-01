// Imports
const electron = require('electron');
const path = require('path');
const request = require('request');
const fs = require('fs');

// Custom imports
const logger = require('./logger');

// Electron modules
const {app} = electron;
const {ipcMain} = electron;
const {autoUpdater} = electron;
const {shell} = electron;
const {dialog} = electron;
const {BrowserWindow} = electron;

const win = BrowserWindow.getFocusedWindow();

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

    torrents = filepaths.filter(filterFiles);

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
