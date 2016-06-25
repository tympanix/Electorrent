// The Electron module
const electron = require('electron');

// Module to control application life.
const {app} = electron;

// Module to create native browser window.
const {BrowserWindow} = electron;

// Require IPC module to communicate with render processes
const {ipcMain} = electron;

// LevelDB for storing configurations
const level = require('level');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let torrentWindow;
let connectWindow;

// Configurations database
const config = level('./config', { valueEncoding: 'json' });
global.config = config;

config.get('animal', function(err, animal){
    console.log("Config", animal);
});

// config.put('animnal', 'bear', function(){
//     console.log("Put key");
// })

// Load arguments
global.arguments = process.argv.splice(1);
global.arguments.forEach(function(val,index, array) {
    console.log(index + ': ' + val);
});

function createTorrentWindow() {
    // Create the browser window.
    torrentWindow = new BrowserWindow({show: false, width: 1200, height: 800, backgroundColor: '#ffffff'});

    torrentWindow.once('ready-to-show', () => {
        console.log("FINISH LOAD!");
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

    torrentWindow.openDevTools();
}

function createConnectWindow(){
    connectWindow = new BrowserWindow({
        parent: torrentWindow,
        modal: true,
        width: 500, height: 300,
        show: false
    });

    connectWindow.loadURL(`file://${__dirname}/connect.html`);

    connectWindow.on('closed', () => {
        connectWindow = null;
        console.log("Connect window closed!");
    });
}

// If another instance of the app is allready running, execute this callback
var shouldQuit = app.makeSingleInstance(function(commandLine, workingDirectory) {
    // Someone tried to run a second instance, we should focus our window
    if (torrentWindow) {
        if (torrentWindow.isMinimized()) torrentWindow.restore();
        torrentWindow.focus();
    }
    return true;
});

if (shouldQuit) {
    app.quit();
    return;
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function(){
    createTorrentWindow();
    createConnectWindow();
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
        createWindow();
    }
});

ipcMain.on('show-connect', function(){
    if (!connectWindow){
        createConnectWindow();
    }
    connectWindow.show();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
