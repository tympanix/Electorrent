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

if (os.platform() === 'win32') {
    autoUpdater.setFeedURL(ENDPOINT + 'update/win32/' + version + '/RELEASE');
} else if (os.platform() === 'darwin') {
    autoUpdater.setFeedURL(ENDPOINT + 'update/osx/' + version);
}

// When new release is ready

exports.watchUpdate = function(dialogWindow) {
    autoUpdater.on('update-downloaded', function (event, releaseNotes, releaseName /*, releaseDate, updateUrl, quitAndUpdate*/) {

        var index = dialog.showMessageBox(dialogWindow, {
            type: 'info',
            buttons: ["Install And Restart", "Later"],
            title: app.getName(),
            message: 'A new version of ' + app.getName() + ' is available.',
            detail: releaseName + "\n\n" + releaseNotes
        });

        if (index === 1) {
            return;
        }

        // Restart app
        autoUpdater.quitAndInstall();

    });
}
