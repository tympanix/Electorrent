// The Electron module
const electron = require('electron');

// Module to control application life.
const {app} = electron;

// Get dialog module
const {dialog} = electron;

// Get the auto updater module
const {autoUpdater} = electron;

// Require OS module
const os = require('os');

// Heroku endpoint to release server
const ENDPOINT = 'https://electorrent.herokuapp.com/';

// Get the version number
const version = app.getVersion();

var updateUrl = null;

if (os.platform() === 'win32') {
    updateUrl = ENDPOINT + 'update/win32/' + version;
} else if (os.platform() === 'darwin') {
    updateUrl = ENDPOINT + 'update/osx/' + version;
}

exports.watchUpdate = function(torrentWindow) {
    try {
        // Set the URL to the release server
        autoUpdater.setFeedURL(updateUrl);

        // Check for updates
        autoUpdater.checkForUpdates();

        // Handle events
        autoUpdater.on('error', function(/*err*/) {
            torrentWindow.webContents.send('notify', {
                title: 'Update Error',
                message: 'Could not update Electorrent. Please visit the website instead',
                type: 'negative'
            });
            //logger.error('update error', err.message, err.stack);
        });
        autoUpdater.on('checking-for-update', function() {
            torrentWindow.webContents.send('notify', {
                title: 'Checking for update',
                message: 'Checking for new updates',
                type: 'info'
            });
            //logger.verbose('checking for update', arguments);
        });
        autoUpdater.on('update-available', function() {
            torrentWindow.webContents.send('notify', {
                title: 'Update Available!',
                message: 'We are downloading the newest version of Electorrent for you!',
                type: 'info'
            });
            //logger.verbose('update available', arguments);
        });
        autoUpdater.on('update-not-available', function() {
            torrentWindow.webContents.send('notify', {
                title: 'Up to date!',
                message: 'Your version of electron is up to date',
                type: 'positive'
            });
            //logger.verbose('update not available', arguments);
        });
        autoUpdater.on('update-downloaded', function(event, releaseNotes, releaseName/*, releaseDate, updateUrl*/) {
            var index = dialog.showMessageBox(torrentWindow, {
                type: 'info',
                buttons: ["Install Now", "Install Later"],
                title: app.getName(),
                message: 'A new version of ' + app.getName() + ' is available.',
                detail: releaseName + "\n\n" + releaseNotes
            });

            if (index === 1) {
                return;
            }

            // Restart app
            autoUpdater.quitAndInstall();
            //logger.info('update downloaded', arguments);
        });
    } catch (e) {
        torrentWindow.webContents.send('notify', {
            title: 'Update Error',
            message: 'Could not check version automatically. Please visit the website instead',
            type: 'negative'
        });
        //logger.debug('AutoUpdater init error', e.message, e.stack);
    }
}
