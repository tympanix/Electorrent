// The Electron module
const electron = require('electron');
const yargs = require('yargs');
const path = require('path');
const is = require('electron-is');
require('@electron/remote/main').initialize();

// Handle Squirrel startup parameters
if (require('./lib/startup')) return

// Electron modules
const { app } = electron;
const { BrowserWindow } = electron;
const { ipcMain } = electron;
const { session } = electron;
const { nativeImage } = electron;

// Set up program arguments
yargs.version(() => app.getVersion())
yargs.help('h').alias('h', 'help')
yargs.usage(`Electorrent ${app.getVersion()}`)
yargs.boolean('v').alias('v', 'verbose').describe('v', 'Enable verbose logging')
yargs.boolean('d').alias('d', 'debug').describe('d', 'Start in debug mode')

// Custom modules
const config = require('./lib/config');
const updater = require('./lib/update');
const logger = require('./lib/logger');
const electorrent = require('./lib/electorrent');
const torrents = require('./lib/torrents');

// Log startup information
logger.debug('Starting Electorrent in debug mode');
logger.verbose('Verbose logging enabled');

// Use the electron-reloader plugin for live reload during development
try {
	require('electron-reloader')(module);
} catch {}

// Global windows object reference
let torrentWindow;

function createTorrentWindow() {
    var windowSettings = {
        show: false,
        width: 1200,
        height: 800,
        backgroundColor: '#ffffff',
        icon: nativeImage.createFromPath(getApplicationIcon()),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            nodeIntegrationInWorker: true,
            enableRemoteModule: true
        }
    }

    Object.assign(windowSettings, config.get('windowsize'));

    // Create the browser window.
    torrentWindow = new BrowserWindow(windowSettings);

    // Enable the remote module to access main-process-only objects from
    // the renderer process
    require("@electron/remote/main").enable(torrentWindow.webContents)

    torrentWindow.once('ready-to-show', () => {
        torrentWindow.show();
        electorrent.setWindow(torrentWindow);
    });

    torrentWindow.loadURL(`file://${__dirname}/index.html`);

    // Save window size when closing
    torrentWindow.on('close', () => {
        config.put('windowsize', torrentWindow.getBounds())
        config.write();
    })

    // Emitted when the window is closed.
    torrentWindow.on('closed', () => {
        // Dereference the window object
        torrentWindow = null;
    });
}

function getApplicationIcon() {
    if (is.linux()) {
        return path.join(__dirname, 'build/png/128x128.png')
    } else if (is.windows()) {
        return path.join(__dirname, 'build/icon.ico')
    } else if (is.macOS()) {
        return path.join(__dirname, 'build/icon.icns')
    }
}

function sendMagnetLinks(args) {
    var magnetLinks = args.filter((url) => url.startsWith('magnet'))
    if(magnetLinks.length === 0) return
    torrentWindow.webContents.send('magnet', magnetLinks);
}

function sendTorrentFiles(args) {
    logger.info('Main searching for files in', args)
    var torrentFiles = args.filter((path) => path.endsWith('.torrent'))
    if(torrentFiles.length === 0) return
    logger.info('Main seding torrent files', torrentFiles)
    torrents.readFiles(torrentFiles)
}

ipcMain.on('send:magnets', function() {
    sendMagnetLinks(process.argv);
})

ipcMain.on('send:torrentfiles', function() {
    logger.info('Main received send torrentfiles')
    sendTorrentFiles(process.argv);
})

ipcMain.on('settings:corrupt', function() {
    config.showCorruptDialog()
})

// If another instance of the app is allready running, execute this callback
if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
} else {
    app.on('second-instance', function(event, args, /*workingDirectory*/) {
        // Someone tried to run a second instance, we should focus our window

        if(torrentWindow) {
            sendMagnetLinks(args)
            sendTorrentFiles(args)
            if(torrentWindow.isMinimized()) torrentWindow.restore();
            torrentWindow.focus();
        }
    })
};

// Set to true in electorrent 9
app.allowRendererProcessReuse = false

// Handle magnet links on MacOS
app.on('open-url', function(event, url) {
    if(torrentWindow) {
        sendMagnetLinks([url]);
    } else {
        process.argv.push(url);
    }
});

// Handle file associations on MacOS
app.on('open-file', function(event, path) {
    if (torrentWindow) {
        sendTorrentFiles([path]);
    } else {
        process.argv.push(path);
    }
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function() {
    createTorrentWindow();
    updater.initialise(torrentWindow);

    // Remove unnecessary headers from web requests
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        let {requestHeaders} = details
        delete requestHeaders.Referer
        delete requestHeaders.Origin
        callback({requestHeaders})
    })
});

// Handle self-signed/untrusted certificates
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    let certs = config.get('certificates') || []

    if (certs.find(c => c === certificate.fingerprint)) {
        event.preventDefault()
        callback(true)
    } else {
        torrentWindow.webContents.send('certificate-error', certificate);
        callback(false)
    }
})

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if(process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if(torrentWindow === null) {
        createTorrentWindow();
    }
});
