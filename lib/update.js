// Imports
const electron = require('electron');
const is = require('electron-is');
const path = require('path');
const semver = require('semver');
const request = require('request');

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

if(is.windows()) {
    updateUrl = ENDPOINT + 'update/win32/' + version;
} else if(is.macOS()) {
    updateUrl = ENDPOINT + 'update/osx/' + version;
} else if(is.linux()) {
    updateUrl = ENDPOINT + 'update/linux/' + version;
}

exports.checkForUpdates = function() {
    // Only windows supports Squirrel as for now
    if(/*is.windows()*/ false) {
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

function manualDownloader() {
    mainWindow.webContents.session.on('will-download', (event, item/*, webContents*/) => {
        const totalBytes = item.getTotalBytes();
        const filePath = path.join(app.getPath('downloads'), item.getFilename())

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
                if (is.macOS()) {
                    app.dock.downloadFinished(filePath);
                }

                // Open the installer and quit app
                shell.openItem(item.getSavePath());
                app.quit();
            }
        })
    })
}

function manualUpdater() {
    request(updateUrl, function(error, response, body) {
        if(error) {
            mainWindow.webContents.send('notify', {
                title: 'Update Error',
                message: 'Could not update Electorrent. Please visit the website instead',
                type: 'negative'
            });
            return;
        }

        if(response.statusCode === 204) {
            // No new version
            mainWindow.webContents.send('notify', {
                title: 'Up to date!',
                message: 'Your version of electron is up to date',
                type: 'positive'
            });
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

                mainWindow.webContents.send('manualUpdate', {
                    releaseNotes: info.notes,
                    releaseName: info.name,
                    releaseDate: info.pub_date,
                    updateUrl: info.url,
                    manual: true
                });

                if (is.macOS()){
                    app.dock.bounce();
                }
            }
        }
    })
}

function squirrelUpdater() {
    try {
        // Set the URL to the release server
        autoUpdater.setFeedURL(updateUrl);

        // Handle events
        autoUpdater.on('error', function( /*err*/ ) {
            mainWindow.webContents.send('notify', {
                title: 'Update Error',
                message: 'Could not update Electorrent. Please visit the website instead',
                type: 'negative'
            });
            //logger.error('update error', err.message, err.stack);
        });
        autoUpdater.on('checking-for-update', function() {
            mainWindow.webContents.send('notify', {
                title: 'Checking for update',
                message: 'Checking for new updates',
                type: 'info'
            });
            //logger.verbose('checking for update', arguments);
        });
        autoUpdater.on('update-available', function() {
            mainWindow.webContents.send('notify', {
                title: 'Update Available!',
                message: 'We are downloading the newest version of Electorrent for you!',
                type: 'info'
            });
            //logger.verbose('update available', arguments);
        });
        autoUpdater.on('update-not-available', function() {
            mainWindow.webContents.send('notify', {
                title: 'Up to date!',
                message: 'Your version of electron is up to date',
                type: 'positive'
            });
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
        mainWindow.webContents.send('notify', {
            title: 'Update Error',
            message: 'Could not check version automatically. Please visit the website instead',
            type: 'negative'
        });
    }
}
