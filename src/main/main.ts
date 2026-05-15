import {
    app,
    BrowserWindow,
    nativeImage,
    session,
    type BrowserWindowConstructorOptions,
    type Event as ElectronEvent,
    type WebContents,
} from 'electron'
import is from 'electron-is'
import path from 'path'
import yargs from 'yargs'

import startup from '@main/lib/startup'

declare const __non_webpack_require__: NodeRequire | undefined

if (!startup) {
    void bootstrap()
}

async function bootstrap() {
    const parser = yargs(process.argv.slice(1))
    parser.version(app.getVersion())
    parser.help('h').alias('h', 'help')
    parser.usage(`Electorrent ${app.getVersion()}`)
    parser.boolean('v').alias('v', 'verbose').describe('v', 'Enable verbose logging')
    parser.boolean('d').alias('d', 'debug').describe('d', 'Start in debug mode')

    const [
        { IPC_CHANNELS },
        { bittorrentManager },
        settings,
        updater,
        { default: logger },
        electorrent,
        torrents,
        certificates,
        ipcHandlers,
        menu,
    ] = await Promise.all([
        import('@shared/ipc'),
        import('@main/lib/bittorrent'),
        import('@main/lib/settings'),
        import('@main/lib/update'),
        import('@main/lib/logger'),
        import('@main/lib/electorrent'),
        import('@main/lib/torrents'),
        import('@main/lib/certificates'),
        import('@main/lib/ipc'),
        import('@main/lib/menu'),
    ])

    logger.debug('Starting Electorrent in debug mode')
    logger.verbose('Verbose logging enabled')

    const program = parser.parse(process.argv.slice(1)) as { debug?: boolean; verbose?: boolean }

    if (!app.isPackaged) {
        try {
            const runtimeRequire: NodeRequire = typeof __non_webpack_require__ === 'function'
                ? __non_webpack_require__
                : module.require.bind(module)
            runtimeRequire('electron-reloader')(module)
        } catch {
            // Ignore reloader setup failures in development.
        }
    }

    let torrentWindow: BrowserWindow | null
    const pendingLaunchPayload = {
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

        Object.assign(windowSettings, settings.get('windowsize'))

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
            settings.put('windowsize', torrentWindow?.getBounds())
            settings.write()
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

    async function consumePendingLaunchPayload() {
        return {
            magnets: pendingLaunchPayload.magnets.splice(0),
            torrentFiles: await torrents.readFiles(pendingLaunchPayload.torrentFilePaths.splice(0), false),
        }
    }

    ipcHandlers.registerHandlers({
        isDebug: !!program.debug,
        getWindow: () => torrentWindow,
        consumePendingLaunchPayload,
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
        const certs = settings.get('certificates') || []

        if (certs.find((c: string) => c === certificate.fingerprint)) {
            _event.preventDefault()
            callback(true)
        } else {
            if (torrentWindow && !torrentWindow.isDestroyed()) {
                torrentWindow.webContents.send(IPC_CHANNELS.certificates.challenge, certificates.sanitizeCertificateError(certificate))
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
