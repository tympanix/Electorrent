import {
    app,
    BrowserWindow,
    Menu,
    nativeImage,
    session,
    shell,
    Tray,
    type BrowserWindowConstructorOptions,
    type Event as ElectronEvent,
    type NativeImage,
    type WebContents,
} from 'electron'
import is from 'electron-is'
import path from 'path'
import yargs from 'yargs'

import startup from '@main/lib/startup'
import type { PendingTorrentUploadLink } from '@shared/ipc-contract'

declare const __non_webpack_require__: NodeRequire | undefined

function isMagnetLink(arg: string) {
    return /^magnet:\?/i.test(arg)
}

function isTorrentFilePath(arg: string) {
    return !isMagnetLink(arg) && arg.toLowerCase().endsWith('.torrent')
}

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
        { TorrentFileWatcher },
        titleBar,
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
        import('@main/lib/torrent-file-watcher'),
        import('@main/lib/title-bar'),
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
    let tray: Tray | null = null
    let isQuitting = false
    let rendererLoaded = false
    const pendingLaunchPayload = {
        magnets: [] as PendingTorrentUploadLink[],
        torrentFilePaths: [] as string[],
    }

    const torrentFileWatcher = new TorrentFileWatcher({
        getSettings: () => settings.getAllSettings(),
        getWindow: () => torrentWindow,
        isRendererLoaded: () => rendererLoaded,
        showOrCreateTorrentWindow,
        showTorrentWindow,
    })

    function shouldUseTray() {
        return !app.commandLine.hasSwitch('headless') && settings.get('closeToTray') !== false
    }

    function destroyTray() {
        if (!tray) {
            return
        }

        tray.destroy()
        tray = null

        if (is.macOS()) {
            app.dock.show()
        }
    }

    function saveWindowBounds() {
        if (!torrentWindow || torrentWindow.isDestroyed()) {
            return
        }

        settings.put('windowsize', torrentWindow.getBounds())
        settings.write()
    }

    function hideTorrentWindow() {
        if (!torrentWindow || torrentWindow.isDestroyed()) {
            return
        }

        saveWindowBounds()
        torrentWindow.hide()

        if (is.macOS()) {
            app.dock.hide()
        }
    }

    function showTorrentWindow() {
        if (!torrentWindow || torrentWindow.isDestroyed()) {
            return
        }

        if (is.macOS()) {
            app.dock.show()
        }

        if (torrentWindow.isMinimized()) {
            torrentWindow.restore()
        }

        if (!torrentWindow.isVisible()) {
            torrentWindow.show()
        }

        torrentWindow.focus()
    }

    function showOrCreateTorrentWindow() {
        if (!torrentWindow || torrentWindow.isDestroyed()) {
            createTorrentWindow()
            return
        }

        showTorrentWindow()
    }

    function createTorrentWindow() {
        const titleBarOptions = titleBar.getTitleBarWindowOptions(settings.get('ui')?.theme)
        const windowSettings: BrowserWindowConstructorOptions = {
            ...titleBarOptions,
            show: false,
            width: 1200,
            height: 800,
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
        rendererLoaded = false
        electorrent.setWindow(torrentWindow)
        menu.setWindow(torrentWindow)

        torrentWindow.once('ready-to-show', () => {
            torrentWindow?.show()
        })

        torrentWindow.loadURL(`file://${__dirname}/index.html`)

        const windowWebContents: WebContents = torrentWindow.webContents
        windowWebContents.on('did-start-loading', () => {
            rendererLoaded = false
        })
        windowWebContents.on('did-finish-load', () => {
            rendererLoaded = true
        })
        const isExternalUrl = (url: string) => {
            try {
                const parsedUrl = new URL(url)
                return ['http:', 'https:', 'mailto:'].includes(parsedUrl.protocol)
            } catch {
                return false
            }
        }
        const openInDefaultBrowser = (url: string) => {
            void shell.openExternal(url).catch((error) => {
                logger.error('Failed to open external URL', { url, error })
            })
        }

        windowWebContents.setWindowOpenHandler(({ url }) => {
            if (isExternalUrl(url)) {
                openInDefaultBrowser(url)
            }

            return { action: 'deny' }
        })

        windowWebContents.on('will-navigate', (event, url) => {
            if (!isExternalUrl(url)) {
                return
            }

            event.preventDefault()
            openInDefaultBrowser(url)
        })

        torrentWindow.on('close', (event) => {
            if (!isQuitting && tray) {
                event.preventDefault()
                hideTorrentWindow()
                return
            }

            saveWindowBounds()
            bittorrentManager.disconnectWindow(windowWebContents)
        })

        torrentWindow.on('closed', () => {
            torrentWindow = null
            rendererLoaded = false
            refreshTrayMenu()
        })

        torrentWindow.on('show', () => {
            refreshTrayMenu()
        })

        torrentWindow.on('hide', () => {
            refreshTrayMenu()
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

    function getTrayIcon(): NativeImage {
        const trayIconPath = is.macOS()
            ? path.join(__dirname, 'build/png/trayTemplate.png')
            : is.windows()
                ? path.join(__dirname, 'build/icon.ico')
                : path.join(__dirname, 'build/png/32x32.png')

        const trayIcon = nativeImage.createFromPath(trayIconPath)
        if (is.macOS() && !trayIcon.isEmpty()) {
            trayIcon.setTemplateImage(true)
        }

        return trayIcon
    }

    function refreshTrayMenu() {
        if (!tray) {
            return
        }

        const isWindowVisible = !!torrentWindow && !torrentWindow.isDestroyed() && torrentWindow.isVisible()
        tray.setContextMenu(Menu.buildFromTemplate([
            {
                label: isWindowVisible ? 'Hide Electorrent' : 'Show Electorrent',
                click: () => {
                    if (isWindowVisible) {
                        hideTorrentWindow()
                    } else {
                        showOrCreateTorrentWindow()
                    }
                },
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => app.quit(),
            },
        ]))
    }

    function createTray() {
        if (tray || !shouldUseTray()) {
            return
        }

        const trayIcon = getTrayIcon()
        if (trayIcon.isEmpty()) {
            logger.error('Tray icon could not be loaded')
            return
        }

        try {
            tray = new Tray(trayIcon)
        } catch (error) {
            logger.error('Failed to initialise system tray', error)
            tray = null
            return
        }

        tray.setToolTip(app.name)
        tray.on('click', () => {
            refreshTrayMenu()
            tray?.popUpContextMenu()
        })
        refreshTrayMenu()
    }

    function syncTray() {
        if (shouldUseTray()) {
            createTray()
            refreshTrayMenu()
            return
        }

        destroyTray()
    }

    function getMagnetLinks(args: string[]): string[] {
        return args.filter(isMagnetLink)
    }

    function getTorrentFilePaths(args: string[]): string[] {
        return args.filter(isTorrentFilePath)
    }

    function queuePendingLaunchArgs(args: string[]) {
        pendingLaunchPayload.magnets.push(...getMagnetLinks(args).map((uri) => torrents.serializeMagnetLink(uri)))
        pendingLaunchPayload.torrentFilePaths.push(...getTorrentFilePaths(args))
    }

    async function sendMagnetLinks(args: string[]) {
        const magnetLinks = getMagnetLinks(args).map((uri) => torrents.serializeMagnetLink(uri))
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
        if (!rendererLoaded) {
            pendingLaunchPayload.torrentFilePaths.push(...torrentFiles)
            return
        }
        torrentWindow.webContents.send(IPC_CHANNELS.launch.torrentFiles, files)
    }

    async function consumePendingLaunchPayload() {
        return {
            magnets: pendingLaunchPayload.magnets.splice(0),
            torrentFiles: [
                ...(await torrents.readFiles(pendingLaunchPayload.torrentFilePaths.splice(0), false)),
                ...torrentFileWatcher.consumePendingPromptedTorrentFiles(),
            ],
        }
    }

    ipcHandlers.registerHandlers({
        isDebug: !!program.debug,
        getWindow: () => torrentWindow,
        consumePendingLaunchPayload,
        onSettingsSaved: async (newSettings) => {
            syncTray()
            torrentFileWatcher.refresh()
            if (torrentWindow) {
                titleBar.updateTitleBarOverlay(torrentWindow, newSettings.ui.theme)
            }
        },
        onBittorrentConnected: async () => {
            await torrentFileWatcher.flushPendingSilentWatcherFiles()
        },
    })

    if (!app.requestSingleInstanceLock()) {
        app.quit()
    } else {
        app.on('second-instance', function(_event: ElectronEvent, args: string[]) {
            if (torrentWindow) {
                sendMagnetLinks(args)
                sendTorrentFiles(args)
                showTorrentWindow()
            } else {
                queuePendingLaunchArgs(args)
                showOrCreateTorrentWindow()
            }
        })
    }

    app.on('open-url', function(_event: ElectronEvent, url: string) {
        if (torrentWindow) {
            sendMagnetLinks([url])
            showTorrentWindow()
        } else {
            queuePendingLaunchArgs([url])
            showOrCreateTorrentWindow()
        }
    })

    app.on('open-file', function(_event: ElectronEvent, filePath: string) {
        if (torrentWindow) {
            sendTorrentFiles([filePath])
            showTorrentWindow()
        } else {
            queuePendingLaunchArgs([filePath])
            showOrCreateTorrentWindow()
        }
    })

    app.on('ready', function() {
        queuePendingLaunchArgs(process.argv)
        createTorrentWindow()
        syncTray()
        torrentFileWatcher.start()
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

    app.on('before-quit', () => {
        isQuitting = true
        torrentFileWatcher.stop()
    })

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin' || app.commandLine.hasSwitch('headless')) {
            app.quit()
        }
    })

    app.on('activate', () => {
        if (torrentWindow === null) {
            createTorrentWindow()
        } else {
            showTorrentWindow()
        }
    })
}
