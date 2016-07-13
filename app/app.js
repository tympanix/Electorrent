// The Electron module
const electron = require('electron');

// Module to control application life.
const {app} = electron;

// Handle Squirrel startup parameters
if(require('electron-squirrel-startup')) return;

// Module to create native browser window.
const {BrowserWindow} = electron;

// Require path nodejs module
const path = require('path');

const winston = require('winston');

const logfile = path.join(app.getPath('userData'), 'somefile.log')
const logger = new (winston.Logger)({
    transports: [
        new (winston.transports.File)({ filename: logfile })
    ]
});

logger.info("Starting app!");

// Require IPC module to communicate with render processes
const {ipcMain} = electron;

const {dialog} = electron;

// Configuration module
const config = require('./lib/config.js');
config.init(path.join(app.getPath('userData'), 'config.json'));
global.config = config;

// Auto update module
const updater = require('./lib/update.js')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
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

    // and load the index.html of the app.
    torrentWindow.loadURL(`file://${__dirname}/index.html`);

    // Emitted when the window is closed.
    torrentWindow.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        torrentWindow = null;
    });

    //torrentWindow.openDevTools();
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
        logger.info("Magnet links: " + args);
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
    logger.info("Open URL " + url)
    sendMagnetLinks([url]);
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function(){
    createTorrentWindow();
    updater.watchUpdate(torrentWindow);
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
