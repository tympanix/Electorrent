// Imports
const electron = require('electron');
const is = require('electron-is');
const path = require('path');
const semver = require('semver');
const request = require('request');
const fs = require('fs');

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

if(is.windows()) {
    updateUrl = ENDPOINT + 'update/win32/' + version;
} else if(is.macOS()) {
    updateUrl = ENDPOINT + 'update/osx/' + version;
} else if(is.linux()) {
    updateUrl = ENDPOINT + 'update/linux/' + version;
}

exports.checkForUpdates = function() {
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
            notifyUpdateError();
            return;
        }

        if(response.statusCode === 204) {
            // No new version
            notifyUpToDate();
            return;
        }

        if(response.statusCode === 200) {
            var info = JSON.parse(body);
            var newVersion = semver.clean(info.name);
            if (!semver.valid(newVersion)){
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

function notifyUpdateError() {
    mainWindow.webContents.send('notify', {
        title: 'Update Error',
        message: 'Could not update Electorrent. Please visit the website instead',
        type: 'negative'
    });
}

function notifyCheckingUpdate() {
    mainWindow.webContents.send('notify', {
        title: 'Checking for update',
        message: 'Checking for new updates',
        type: 'info'
    });
}

function notifyUpdateAvailable() {
    mainWindow.webContents.send('notify', {
        title: 'Update Available!',
        message: 'We are downloading the newest version of Electorrent for you!',
        type: 'info'
    });
}

function notifyUpToDate() {
    mainWindow.webContents.send('notify', {
        title: 'Up to date!',
        message: 'Your version of electron is up to date',
        type: 'positive'
    });
}

function notifyConnectionError() {
    mainWindow.webContents.send('notify', {
        title: 'Update Error',
        message: 'Could not check version automatically. Please visit the website instead',
        type: 'negative'
    });
}

function squirrelUpdater() {
    try {
        // Set the URL to the release server
        autoUpdater.setFeedURL(updateUrl);

        // Handle events
        autoUpdater.on('error', function( /*err*/ ) {
            notifyUpdateError();
            //logger.error('update error', err.message, err.stack);
        });
        autoUpdater.on('checking-for-update', function() {
            notifyCheckingUpdate();
            //logger.verbose('checking for update', arguments);
        });
        autoUpdater.on('update-available', function() {
            notifyUpdateAvailable();
            //logger.verbose('update available', arguments);
        });
        autoUpdater.on('update-not-available', function() {
            notifyUpToDate();
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
        notifyConnectionError();
    }
}
