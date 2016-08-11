// The Electron module
const electron = require('electron');

// Module to control application life.
const {app} = electron;

// IpcMain module
const {ipcMain} = electron;

// Get the auto updater module
const {autoUpdater} = electron;

// Require electron-is
const is = require('electron-is');

// Require semver
const semver = require('semver');

// Require request HTTP module
const request = require('request');

// Heroku endpoint to release server
const ENDPOINT = 'https://electorrent.herokuapp.com/';

// Get the version number
const version = app.getVersion();

var updateUrl = null;
var mainWindow = null;

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
}

ipcMain.on('startUpdate', (event, url) => {
    mainWindow.webContents.downloadURL(url);
});

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
                mainWindow.webContents.send('manualUpdate', {
                    releaseNotes: info.notes,
                    releaseName: info.name,
                    releaseDate: info.pub_date,
                    updateUrl: info.url,
                    manual: true
                });
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

        });
    } catch(e) {
        mainWindow.webContents.send('notify', {
            title: 'Update Error',
            message: 'Could not check version automatically. Please visit the website instead',
            type: 'negative'
        });
    }
}