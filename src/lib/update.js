// Imports
const electron = require('electron');
const is = require('electron-is');
const path = require('path');
const semver = require('semver');
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

// Heroku endpoint to release server
const ENDPOINT = 'https://electorrent.herokuapp.com/';

// Get the version number
const version = app.getVersion();

var updateUrl = null;
var mainWindow = null;
var manualDownloadURL = null;
var update = null;
var downloadedUpdate = null;
var verbose = false;

if(is.windows()) {
    updateUrl = ENDPOINT + 'update/win32/' + version;
} else if(is.macOS()) {
    updateUrl = ENDPOINT + 'update/osx/' + version;
} else if(is.linux()) {
    updateUrl = ENDPOINT + 'update/linux/' + version;
}

exports.checkForUpdates = function(notifyVerbose) {
    if (notifyVerbose === true){
        verbose = true;
    } else {
        verbose = false;
    }

    // Only windows supports Squirrel as for now
    if(is.windows()) {
        autoUpdater.checkForUpdates();
    } else {
        manualUpdater();
    }
}

exports.initialise = function(initWindow) {
    mainWindow = initWindow;
    squirrelUpdater();
    manualDownloader();
}

exports.manualQuitAndUpdate = function() {
    // Open the installer and quit app
    var isExecuteable = fs.constants.F_OK && fs.constants.X_OK;
    fs.access(downloadedUpdate, isExecuteable, (err) => {
        if (err) {
            logger.error('Error while executing update', arguments);
            shell.showItemInFolder(downloadedUpdate);
        } else {
            shell.openItem(downloadedUpdate);
            app.quit();
        }
    })
}

exports.openUpdateFilePath = function() {
    // Open the downloaded file in a file browser
    shell.showItemInFolder(downloadedUpdate);
}

ipcMain.on('startUpdate', (/*event*/) => {
    if (manualDownloadURL) {
        var url = manualDownloadURL;
        url = url.substr(0, url.lastIndexOf('?'));

        mainWindow.webContents.downloadURL(url);
    } else {
        mainWindow.webContents.send('notify', {
            title: 'Update Error',
            message: 'Could not update Electorrent. Please visit the website instead',
            type: 'negative'
        });
    }
});

function downloadUpdate(updateUrl){
    var url = updateUrl;
    url = url.substr(0, url.lastIndexOf('?'));
    mainWindow.webContents.downloadURL(url);
}

function filePostfix() {
    var date = new Date();
    var day = date.getDate();
    var month = date.getMonth() + 1;
    var hour = date.getHours();
    var minute = date.getMinutes();
    var seconds = date.getSeconds();

    return `${month}.${day}-${hour}.${minute}.${seconds}`

}

function getUniqueFilename(filename) {
    var extension = path.extname(filename);
    var file = path.basename(filename, extension);
    var postfix = filePostfix();
    return `${file} (${postfix})${extension}`;
}

function manualDownloader() {
    mainWindow.webContents.session.on('will-download', (event, item/*, webContents*/) => {
        const totalBytes = item.getTotalBytes();
        const filePath = path.join(app.getPath('downloads'), getUniqueFilename(item.getFilename()))

        item.setSavePath(filePath);

        item.on('updated', (/*event, state*/) => {
            mainWindow.setProgressBar(item.getReceivedBytes() / totalBytes);
        });

        item.on('done', (event, state) => {
            if (!mainWindow.isDestroyed()) {
                mainWindow.setProgressBar(-1);
            }

            if (state === 'interrupted') {
                logger.error('The download update was interrupted', state);
                electron.dialog.showErrorBox('Download error', `The download of ${item.getFilename()} was interrupted`);
            }

            if (state === 'completed') {

                downloadedUpdate = item.getSavePath();

                mainWindow.webContents.send('manualUpdate', {
                    releaseNotes: update.notes,
                    releaseName: update.name,
                    releaseDate: update.pub_date,
                    updateUrl: update.url,
                    manual: true
                });
            }
        })
    })
}

function manualUpdater() {
    request(updateUrl, function(error, response, body) {
        if(error) {
            logger.error('Manual updater error', arguments);
            notifyUpdateError();
            return;
        }

        if(response.statusCode === 204) {
            // No new version
            logger.verbose('Manual no new update available', arguments);
            notifyUpToDate();
            return;
        }

        if(response.statusCode === 200) {
            logger.verbose('Manual updater found update', arguments);

            var info = JSON.parse(body);
            var newVersion = semver.clean(info.name);
            if (!semver.valid(newVersion)){
                logger.error('Manual updater invalid semver', arguments);
                return;
            }

            if (semver.gt(newVersion, version)){
                // New update
                manualDownloadURL = info.url;
                update = info;
                downloadUpdate(info.url);
                notifyUpdateAvailable();
            }
        }
    })
}

function notify({ title = '', message = '', type = 'info'}) {
    var win = electorrent.getWindow();
    if (!win) return;

    win.webContents.send('notify', {
        title: title,
        message: message,
        type: type
    });
}

function notifyUpdateError() {
    notify({
        title: 'Update Error',
        message: 'Could not update Electorrent. Please visit the website instead',
        type: 'negative'
    })
}

function notifyCheckingUpdate() {
    if (!verbose) return;

    notify({
        title: 'Checking for update',
        message: 'Checking for new updates',
        type: 'info'
    })
}

function notifyUpdateAvailable() {
    notify({
        title: 'Update Available!',
        message: 'We are downloading the newest version of Electorrent for you!',
        type: 'info'
    })
}

function notifyUpToDate() {
    if (!verbose) return;

    notify({
        title: 'Up to date!',
        message: 'Your version of Electorrent is up to date',
        type: 'positive'
    })
}

function notifyConnectionError() {
    notify({
        title: 'Update Error',
        message: 'Could not check version automatically. Please visit the website instead',
        type: 'negative'
    })
}

function squirrelUpdater() {

    if (!is.windows()) {
        logger.verbose('Squirrel skip initialization on non-windows platforms')
        return;
    }

    try {
        // Set the URL to the release server
        autoUpdater.setFeedURL(updateUrl);

        // Handle events
        autoUpdater.on('error', function(/*err*/) {
            notifyUpdateError();
            logger.error('Squirrel updater could not update', arguments);
        });
        autoUpdater.on('checking-for-update', function() {
            notifyCheckingUpdate();
            logger.verbose('Squirrel checking for update', arguments);
        });
        autoUpdater.on('update-available', function() {
            notifyUpdateAvailable();
            logger.verbose('Squirrel update available', arguments);
        });
        autoUpdater.on('update-not-available', function() {
            notifyUpToDate();
            logger.verbose('Squirrel no new update available', arguments);
        });
        autoUpdater.on('update-downloaded', function(event, releaseNotes, releaseName, releaseDate, updateUrl) {

            mainWindow.webContents.send('autoUpdate', {
                releaseNotes: releaseNotes,
                releaseName: releaseName,
                releaseDate: releaseDate,
                updateUrl: updateUrl
            })

            if (is.macOS()){
                app.dock.bounce();
            }

        });
    } catch(e) {
        logger.error('Squirrel updater threw an exception', arguments);
        notifyConnectionError();
    }
}
