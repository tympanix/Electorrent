// The Electron module
const electron = require('electron');
const program = require('commander');
const path = require('path');

// Handle Squirrel startup parameters
if(require('electron-squirrel-startup')) return;

// Electron modules
const {app} = electron;
const {BrowserWindow} = electron;
const {ipcMain} = electron;

// Custom modules
const config = require('./lib/config.js');
const updater = require('./lib/update.js')

// Global windows object reference
let torrentWindow;

function createTorrentWindow() {
    // Create the browser window.
    torrentWindow = new BrowserWindow({
        show: false,
        width: 1200,
        height: 800,
        backgroundColor: '#ffffff'
    });

    torrentWindow.once('ready-to-show', () => {
        torrentWindow.show();
    });

    torrentWindow.loadURL(`file://${__dirname}/index.html`);

    // Emitted when the window is closed.
    torrentWindow.on('closed', () => {
        // Dereference the window object
        torrentWindow = null;
    });

}

function sendMagnetLinks(args){
    var magnetLinks = [];
    args.forEach(function(val){
        if (val.startsWith('magnet')){
            magnetLinks.push(val);
        }
    })
    torrentWindow.webContents.send('magnet', magnetLinks);
}

ipcMain.on('send:magnets', function(){
    sendMagnetLinks(process.argv);
})

// If another instance of the app is allready running, execute this callback
var shouldQuit = app.makeSingleInstance(function(args /*, workingDirectory*/) {
    // Someone tried to run a second instance, we should focus our window

    if (torrentWindow) {
        sendMagnetLinks(args);
        if (torrentWindow.isMinimized()) torrentWindow.restore();
        torrentWindow.focus();
    }
    return true;

});

if (shouldQuit) {
    app.quit();
    return;
}

// Handle magnet links on MacOS
app.on('open-url', function(event, url) {
    if (torrentWindow) {
        sendMagnetLinks([url]);
    } else {
        process.argv.push(url);
    }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function(){
    createTorrentWindow();
    updater.initialise(torrentWindow);
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (torrentWindow === null) {
        createTorrentWindow();
    }
});
