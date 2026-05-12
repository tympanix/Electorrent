import {
    app,
    BrowserWindow,
    ipcMain,
    nativeImage,
    session,
    shell,
    type BrowserWindowConstructorOptions,
    type Certificate,
    type Event as ElectronEvent,
    type IpcMainInvokeEvent,
    type WebContents,
} from 'electron'

const yargs = require('yargs')
const path = require('path')
const is = require('electron-is')
const { IPC_CHANNELS } = require('../common/ipc')
const { bittorrentManager } = require('./lib/bittorrent')

if (!require('./lib/startup')) {
    yargs.version(() => app.getVersion())
    yargs.help('h').alias('h', 'help')
    yargs.usage(`Electorrent ${app.getVersion()}`)
    yargs.boolean('v').alias('v', 'verbose').describe('v', 'Enable verbose logging')
    yargs.boolean('d').alias('d', 'debug').describe('d', 'Start in debug mode')

    const config = require('./lib/config')
    const updater = require('./lib/update')
    const logger = require('./lib/logger')
    const electorrent = require('./lib/electorrent')
    const torrents = require('./lib/torrents')
    const themes = require('./lib/themes')
    const certificates = require('./lib/certificates')
    const menu = require('./lib/menu')

    logger.debug('Starting Electorrent in debug mode')
    logger.verbose('Verbose logging enabled')

    const program = yargs.argv

    try {
        require('electron-reloader')(module)
    } catch {}

    let torrentWindow: BrowserWindow | null
    let pendingLaunchPayload = {
        magnets: [] as string[],
        torrentFilePaths: [] as string[],
    }

    function createTorrentWindow() {
        const windowSettings: BrowserWindowConstructorOptions = {
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
            },
        }

        Object.assign(windowSettings, config.get('windowsize'))

        torrentWindow = new BrowserWindow(windowSettings)
        electorrent.setWindow(torrentWindow)
        menu.setWindow(torrentWindow)

        torrentWindow.once('ready-to-show', () => {
            torrentWindow?.show()
        })

        torrentWindow.loadURL(`file://${__dirname}/index.html`)

        const windowWebContents: WebContents = torrentWindow.webContents

        torrentWindow.on('close', () => {
            bittorrentManager.disconnectWindow(windowWebContents)
            config.put('windowsize', torrentWindow?.getBounds())
            config.write()
        })

        torrentWindow.on('closed', () => {
            torrentWindow = null
        })
    }

    function getApplicationIcon(): string {
        if (is.linux()) {
            return path.join(__dirname, 'build/png/128x128.png')
        } else if (is.windows()) {
            return path.join(__dirname, 'build/icon.ico')
        } else if (is.macOS()) {
            return path.join(__dirname, 'build/icon.icns')
        }

        return path.join(__dirname, 'build/icon.ico')
    }

    function getMagnetLinks(args: string[]): string[] {
        return args.filter((url) => url.startsWith('magnet'))
    }

    function getTorrentFilePaths(args: string[]): string[] {
        return args.filter((filePath) => filePath.endsWith('.torrent'))
    }

    function queuePendingLaunchArgs(args: string[]) {
        pendingLaunchPayload.magnets.push(...getMagnetLinks(args))
        pendingLaunchPayload.torrentFilePaths.push(...getTorrentFilePaths(args))
    }

    async function sendMagnetLinks(args: string[]) {
        const magnetLinks = getMagnetLinks(args)
        if (magnetLinks.length === 0 || !torrentWindow || torrentWindow.isDestroyed()) return
        torrentWindow.webContents.send(IPC_CHANNELS.launch.magnets, magnetLinks)
    }

    async function sendTorrentFiles(args: string[]) {
        logger.info('Main searching for files in', args)
        const torrentFiles = getTorrentFilePaths(args)
        if (torrentFiles.length === 0 || !torrentWindow || torrentWindow.isDestroyed()) return
        logger.info('Main sending torrent files', torrentFiles)
        const files = await torrents.readFiles(torrentFiles, false)
        if (files.length === 0) return
        torrentWindow.webContents.send(IPC_CHANNELS.launch.torrentFiles, files)
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

    function sanitizeCertificateError(certificate: Certificate) {
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

    ipcMain.handle(IPC_CHANNELS.app.getMeta, async function() {
        return getAppMeta()
    })

    ipcMain.handle(IPC_CHANNELS.app.getDefaultProtocolStatus, async function(_event: IpcMainInvokeEvent, { protocol }) {
        return app.isDefaultProtocolClient(protocol)
    })

    ipcMain.handle(IPC_CHANNELS.app.setDefaultProtocolStatus, async function(_event: IpcMainInvokeEvent, { protocol, enabled }) {
        if (enabled) {
            app.setAsDefaultProtocolClient(protocol)
        } else {
            app.removeAsDefaultProtocolClient(protocol)
        }
    })

    ipcMain.handle(IPC_CHANNELS.app.quit, async function() {
        app.quit()
    })

    ipcMain.handle(IPC_CHANNELS.app.reportCorruptSettings, async function() {
        config.showCorruptDialog()
    })

    ipcMain.handle(IPC_CHANNELS.shell.openExternal, async function(_event: IpcMainInvokeEvent, { url }) {
        await shell.openExternal(url)
    })

    ipcMain.handle(IPC_CHANNELS.settings.getAll, async function() {
        return config.getAllSettings()
    })

    ipcMain.handle(IPC_CHANNELS.settings.saveAll, async function(_event: IpcMainInvokeEvent, { settings }) {
        return new Promise<void>((resolve, reject) => {
            config.saveAll(settings, function(err: Error) {
                if (err) reject(err)
                else resolve()
            })
        })
    })

    ipcMain.handle(IPC_CHANNELS.settings.listThemes, async function() {
        return themes()
    })

    ipcMain.handle(IPC_CHANNELS.launch.getPending, async function() {
        const payload = {
            magnets: pendingLaunchPayload.magnets.splice(0),
            torrentFiles: await torrents.readFiles(pendingLaunchPayload.torrentFilePaths.splice(0), false),
        }

        return payload
    })

    ipcMain.handle(IPC_CHANNELS.torrents.openFiles, async function(_event: IpcMainInvokeEvent, { askUploadOptions }) {
        return torrents.browse(askUploadOptions)
    })

    ipcMain.handle(IPC_CHANNELS.bittorrent.connect, async function(event: IpcMainInvokeEvent, { server }) {
        return bittorrentManager.connect(event.sender, server)
    })

    ipcMain.handle(IPC_CHANNELS.bittorrent.disconnect, async function(event: IpcMainInvokeEvent) {
        return bittorrentManager.disconnect(event.sender)
    })

    ipcMain.handle(IPC_CHANNELS.bittorrent.getSnapshot, async function(event: IpcMainInvokeEvent, { fullUpdate } = {}) {
        return bittorrentManager.getSnapshot(event.sender, fullUpdate)
    })

    ipcMain.handle(IPC_CHANNELS.bittorrent.addTorrentUrl, async function(event: IpcMainInvokeEvent, request) {
        return bittorrentManager.addTorrentUrl(event.sender, request)
    })

    ipcMain.handle(IPC_CHANNELS.bittorrent.uploadTorrent, async function(event: IpcMainInvokeEvent, request) {
        return bittorrentManager.uploadTorrent(event.sender, request)
    })

    ipcMain.handle(IPC_CHANNELS.bittorrent.invokeAction, async function(event: IpcMainInvokeEvent, request) {
        return bittorrentManager.invokeAction(event.sender, request)
    })

    ipcMain.handle(IPC_CHANNELS.bittorrent.getTorrentFiles, async function(event: IpcMainInvokeEvent, { hash }) {
        return bittorrentManager.getTorrentFiles(event.sender, hash)
    })

    ipcMain.handle(IPC_CHANNELS.bittorrent.setTorrentFileSelection, async function(event: IpcMainInvokeEvent, request) {
        return bittorrentManager.setTorrentFileSelection(event.sender, request)
    })

    ipcMain.handle(IPC_CHANNELS.updates.check, async function(_event: IpcMainInvokeEvent, { verbose }) {
        updater.checkForUpdates(verbose)
    })

    ipcMain.handle(IPC_CHANNELS.updates.installDownloaded, async function() {
        updater.manualQuitAndUpdate()
    })

    ipcMain.handle(IPC_CHANNELS.updates.installAuto, async function() {
        updater.quitAndInstall()
    })

    ipcMain.handle(IPC_CHANNELS.certificates.fetch, async function(_event: IpcMainInvokeEvent, request) {
        return new Promise((resolve, reject) => {
            certificates.get(request.server, function(err: Error, cert: unknown) {
                if (err) {
                    reject(err)
                    return
                }

                if (torrentWindow && !torrentWindow.isDestroyed()) {
                    torrentWindow.webContents.send(IPC_CHANNELS.certificates.challenge, cert)
                }

                resolve(cert)
            })
        })
    })

    ipcMain.handle(IPC_CHANNELS.certificates.install, async function(_event: IpcMainInvokeEvent, request) {
        return new Promise((resolve, reject) => {
            certificates.installCertificate(request, function(err: Error, fingerprint: string) {
                if (err) reject(err)
                else resolve({ fingerprint })
            })
        })
    })

    ipcMain.handle(IPC_CHANNELS.certificates.load, async function(_event: IpcMainInvokeEvent, { fingerprint }) {
        const cert = certificates.loadCertificate(fingerprint)
        return cert ? new Uint8Array(cert) : null
    })

    ipcMain.handle(IPC_CHANNELS.menu.setState, async function(_event: IpcMainInvokeEvent, state) {
        menu.setState(state)
    })

    if (!app.requestSingleInstanceLock()) {
        app.quit()
    } else {
        app.on('second-instance', function(_event: ElectronEvent, args: string[]) {
            if (torrentWindow) {
                sendMagnetLinks(args)
                sendTorrentFiles(args)
                if (torrentWindow.isMinimized()) torrentWindow.restore()
                torrentWindow.focus()
            } else {
                queuePendingLaunchArgs(args)
            }
        })
    }

    ;(app as any).allowRendererProcessReuse = false

    app.on('open-url', function(_event: ElectronEvent, url: string) {
        if (torrentWindow) {
            sendMagnetLinks([url])
        } else {
            queuePendingLaunchArgs([url])
        }
    })

    app.on('open-file', function(_event: ElectronEvent, filePath: string) {
        if (torrentWindow) {
            sendTorrentFiles([filePath])
        } else {
            queuePendingLaunchArgs([filePath])
        }
    })

    app.on('ready', function() {
        queuePendingLaunchArgs(process.argv)
        createTorrentWindow()
        updater.initialise(torrentWindow)

        session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
            const { requestHeaders } = details
            delete requestHeaders.Referer
            delete requestHeaders.Origin
            callback({ requestHeaders })
        })
    })

    app.on('certificate-error', (_event, _webContents, _url, _error, certificate, callback) => {
        const certs = config.get('certificates') || []

        if (certs.find((c: string) => c === certificate.fingerprint)) {
            _event.preventDefault()
            callback(true)
        } else {
            if (torrentWindow && !torrentWindow.isDestroyed()) {
                torrentWindow.webContents.send(IPC_CHANNELS.certificates.challenge, sanitizeCertificateError(certificate))
            }
            callback(false)
        }
    })

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin' || app.commandLine.hasSwitch('headless')) {
            app.quit()
        }
    })

    app.on('activate', () => {
        if (torrentWindow === null) {
            createTorrentWindow()
        }
    })
}
