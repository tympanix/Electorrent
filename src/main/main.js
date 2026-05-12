// The Electron module
const electron = require('electron');
const yargs = require('yargs');
const path = require('path');
const is = require('electron-is');
const { IPC_CHANNELS } = require('./common/ipc');
const { bittorrentManager } = require('./lib/bittorrent');
const { registerIpcHandlers } = require('./ipc');

// Handle Squirrel startup parameters
if (require('./lib/startup')) return

// Electron modules
const { app } = electron;
const { BrowserWindow } = electron;
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
const themes = require('./lib/themes');
const certificates = require('./lib/certificates');
const menu = require('./lib/menu');

// Log startup information
logger.debug('Starting Electorrent in debug mode');
logger.verbose('Verbose logging enabled');

const program = yargs.argv

// Use the electron-reloader plugin for live reload during development
try {
	require('electron-reloader')(module);
} catch {}

// Global windows object reference
let torrentWindow;
let pendingLaunchPayload = {
    magnets: [],
    torrentFilePaths: [],
};

function createTorrentWindow() {
    var windowSettings = {
        show: false,
        width: 1200,
        height: 800,
        backgroundColor: '#ffffff',
        icon: nativeImage.createFromPath(getApplicationIcon()),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            preload: path.join(__dirname, 'preload.js'),
        }
    }

    Object.assign(windowSettings, config.get('windowsize'));

    // Create the browser window.
    torrentWindow = new BrowserWindow(windowSettings);
    electorrent.setWindow(torrentWindow);
    menu.setWindow(torrentWindow);

    torrentWindow.once('ready-to-show', () => {
        torrentWindow.show();
    });

    torrentWindow.loadURL(`file://${__dirname}/index.html`);

    const windowWebContents = torrentWindow.webContents

    // Save window size when closing
    torrentWindow.on('close', () => {
        bittorrentManager.disconnectWindow(windowWebContents)
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

function getMagnetLinks(args) {
    return args.filter((url) => url.startsWith('magnet'))
}

function getTorrentFilePaths(args) {
    return args.filter((filePath) => filePath.endsWith('.torrent'))
}

function queuePendingLaunchArgs(args) {
    pendingLaunchPayload.magnets.push(...getMagnetLinks(args))
    pendingLaunchPayload.torrentFilePaths.push(...getTorrentFilePaths(args))
}

async function sendMagnetLinks(args) {
    var magnetLinks = getMagnetLinks(args)
    if(magnetLinks.length === 0 || !torrentWindow || torrentWindow.isDestroyed()) return
    torrentWindow.webContents.send(IPC_CHANNELS.launch.magnets, magnetLinks);
}

async function sendTorrentFiles(args) {
    logger.info('Main searching for files in', args)
    var torrentFiles = getTorrentFilePaths(args)
    if(torrentFiles.length === 0 || !torrentWindow || torrentWindow.isDestroyed()) return
    logger.info('Main sending torrent files', torrentFiles)
    const files = await torrents.readFiles(torrentFiles, false)
    if (files.length === 0) return
    torrentWindow.webContents.send(IPC_CHANNELS.launch.torrentFiles, files);
}

function getAppMeta() {
    return {
        appName: app.name,
        appVersion: app.getVersion(),
        isMacOS: is.macOS(),
        isWindows: is.windows(),
        isLinux: is.linux(),
        isDebug: !!program.debug,
        platform: process.platform,
        versions: {
            node: process.versions.node,
            chrome: process.versions.chrome,
            electron: process.versions.electron,
        },
    }
}

function sanitizeCertificateError(certificate) {
    return {
        source: 'main-certificate-error',
        selfSigned: !certificate.issuerCert,
        issuer: {
            country: certificate.issuer && certificate.issuer.country,
            state: certificate.issuer && certificate.issuer.state,
            organization: certificate.issuer && certificate.issuer.organizations && certificate.issuer.organizations[0],
            organizationUnit: certificate.issuer && certificate.issuer.organizationUnits && certificate.issuer.organizationUnits[0],
            commonName: certificate.issuer && certificate.issuer.commonName,
        },
        subject: {
            country: certificate.subject && certificate.subject.country,
            state: certificate.subject && certificate.subject.state,
            organization: certificate.subject && certificate.subject.organizations && certificate.subject.organizations[0],
            organizationUnit: certificate.subject && certificate.subject.organizationUnits && certificate.subject.organizationUnits[0],
            commonName: certificate.subject && certificate.subject.commonName,
        },
        fingerprint: certificate.fingerprint,
        validFrom: certificate.validStart,
        validTo: certificate.validExpiry,
        serialNumber: certificate.serialNumber,
    }
}

registerIpcHandlers({
    config,
    themes,
    torrents,
    bittorrentManager,
    updater,
    certificates,
    menu,
    getAppMeta,
    pendingLaunchPayload,
    getTorrentWindow: () => torrentWindow,
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
        } else {
            queuePendingLaunchArgs(args)
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
        queuePendingLaunchArgs([url]);
    }
});

// Handle file associations on MacOS
app.on('open-file', function(event, path) {
    if (torrentWindow) {
        sendTorrentFiles([path]);
    } else {
        queuePendingLaunchArgs([path]);
    }
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function() {
    queuePendingLaunchArgs(process.argv);
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
        if (torrentWindow && !torrentWindow.isDestroyed()) {
            torrentWindow.webContents.send(IPC_CHANNELS.certificates.challenge, sanitizeCertificateError(certificate));
        }
        callback(false)
    }
})

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if(process.platform !== 'darwin' || app.commandLine.hasSwitch('headless')) {
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
