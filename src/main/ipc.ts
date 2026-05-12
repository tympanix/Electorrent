import { IPC_CHANNELS } from "../common/ipc"

type PendingLaunchPayload = {
    magnets: string[]
    torrentFilePaths: string[]
}

type SaveAllCallback = (err?: unknown) => void
type InstallCertificateCallback = (err?: unknown, fingerprint?: string) => void
type GetCertificateCallback = (err?: unknown, cert?: unknown) => void

type ConfigService = {
    showCorruptDialog: () => void
    getAllSettings: () => unknown
    saveAll: (settings: unknown, callback: SaveAllCallback) => void
}

type TorrentsService = {
    readFiles: (paths: string[], askUploadOptions: boolean) => Promise<unknown>
    browse: (askUploadOptions: boolean) => unknown
}

type BittorrentManager = {
    connect: (sender: Electron.WebContents, server: unknown) => unknown
    disconnect: (sender: Electron.WebContents) => unknown
    getSnapshot: (sender: Electron.WebContents, fullUpdate?: unknown) => unknown
    addTorrentUrl: (sender: Electron.WebContents, request: unknown) => unknown
    uploadTorrent: (sender: Electron.WebContents, request: unknown) => unknown
    invokeAction: (sender: Electron.WebContents, request: unknown) => unknown
    getTorrentFiles: (sender: Electron.WebContents, hash: unknown) => unknown
    setTorrentFileSelection: (sender: Electron.WebContents, request: unknown) => unknown
}

type UpdaterService = {
    checkForUpdates: (verbose?: boolean) => void
    manualQuitAndUpdate: () => void
    quitAndInstall: () => void
}

type CertificatesService = {
    get: (server: unknown, callback: GetCertificateCallback) => void
    installCertificate: (request: unknown, callback: InstallCertificateCallback) => void
    loadCertificate: (fingerprint: string) => Uint8Array | null | undefined
}

type MenuService = {
    setState: (state: unknown) => void
}

type IpcDependencies = {
    app: Electron.App
    ipcMain: Electron.IpcMain
    shell: Electron.Shell
    config: ConfigService
    themes: () => unknown
    torrents: TorrentsService
    bittorrentManager: BittorrentManager
    updater: UpdaterService
    certificates: CertificatesService
    menu: MenuService
    getAppMeta: () => unknown
    pendingLaunchPayload: PendingLaunchPayload
    getTorrentWindow: () => Electron.BrowserWindow | null | undefined
}

export function registerIpcHandlers({
    app,
    ipcMain,
    shell,
    config,
    themes,
    torrents,
    bittorrentManager,
    updater,
    certificates,
    menu,
    getAppMeta,
    pendingLaunchPayload,
    getTorrentWindow,
}: IpcDependencies) {
    ipcMain.handle(IPC_CHANNELS.app.getMeta, async function() {
        return getAppMeta()
    })

    ipcMain.handle(IPC_CHANNELS.app.getDefaultProtocolStatus, async function(_event, { protocol }) {
        return app.isDefaultProtocolClient(protocol)
    })

    ipcMain.handle(IPC_CHANNELS.app.setDefaultProtocolStatus, async function(_event, { protocol, enabled }) {
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

    ipcMain.handle(IPC_CHANNELS.shell.openExternal, async function(_event, { url }) {
        await shell.openExternal(url)
    })

    ipcMain.handle(IPC_CHANNELS.settings.getAll, async function() {
        return config.getAllSettings()
    })

    ipcMain.handle(IPC_CHANNELS.settings.saveAll, async function(_event, { settings }) {
        return new Promise<void>((resolve, reject) => {
            config.saveAll(settings, function(err) {
                if (err) reject(err)
                else resolve()
            })
        })
    })

    ipcMain.handle(IPC_CHANNELS.settings.listThemes, async function() {
        return themes()
    })

    ipcMain.handle(IPC_CHANNELS.launch.getPending, async function() {
        const magnets = pendingLaunchPayload.magnets.slice()
        const torrentFilePaths = pendingLaunchPayload.torrentFilePaths.slice()
        pendingLaunchPayload.magnets.length = 0
        pendingLaunchPayload.torrentFilePaths.length = 0

        return {
            magnets,
            torrentFiles: await torrents.readFiles(torrentFilePaths, false),
        }
    })

    ipcMain.handle(IPC_CHANNELS.torrents.openFiles, async function(_event, { askUploadOptions }) {
        return torrents.browse(askUploadOptions)
    })

    ipcMain.handle(IPC_CHANNELS.bittorrent.connect, async function(event, { server }) {
        return bittorrentManager.connect(event.sender, server)
    })

    ipcMain.handle(IPC_CHANNELS.bittorrent.disconnect, async function(event) {
        return bittorrentManager.disconnect(event.sender)
    })

    ipcMain.handle(IPC_CHANNELS.bittorrent.getSnapshot, async function(event, { fullUpdate } = {}) {
        return bittorrentManager.getSnapshot(event.sender, fullUpdate)
    })

    ipcMain.handle(IPC_CHANNELS.bittorrent.addTorrentUrl, async function(event, request) {
        return bittorrentManager.addTorrentUrl(event.sender, request)
    })

    ipcMain.handle(IPC_CHANNELS.bittorrent.uploadTorrent, async function(event, request) {
        return bittorrentManager.uploadTorrent(event.sender, request)
    })

    ipcMain.handle(IPC_CHANNELS.bittorrent.invokeAction, async function(event, request) {
        return bittorrentManager.invokeAction(event.sender, request)
    })

    ipcMain.handle(IPC_CHANNELS.bittorrent.getTorrentFiles, async function(event, { hash }) {
        return bittorrentManager.getTorrentFiles(event.sender, hash)
    })

    ipcMain.handle(IPC_CHANNELS.bittorrent.setTorrentFileSelection, async function(event, request) {
        return bittorrentManager.setTorrentFileSelection(event.sender, request)
    })

    ipcMain.handle(IPC_CHANNELS.updates.check, async function(_event, { verbose }) {
        updater.checkForUpdates(verbose)
    })

    ipcMain.handle(IPC_CHANNELS.updates.installDownloaded, async function() {
        updater.manualQuitAndUpdate()
    })

    ipcMain.handle(IPC_CHANNELS.updates.installAuto, async function() {
        updater.quitAndInstall()
    })

    ipcMain.handle(IPC_CHANNELS.certificates.fetch, async function(_event, request) {
        return new Promise((resolve, reject) => {
            certificates.get(request.server, function(err, cert) {
                if (err) {
                    reject(err)
                    return
                }

                const torrentWindow = getTorrentWindow()
                if (torrentWindow && !torrentWindow.isDestroyed()) {
                    torrentWindow.webContents.send(IPC_CHANNELS.certificates.challenge, cert)
                }

                resolve(cert)
            })
        })
    })

    ipcMain.handle(IPC_CHANNELS.certificates.install, async function(_event, request) {
        return new Promise((resolve, reject) => {
            certificates.installCertificate(request, function(err, fingerprint) {
                if (err) reject(err)
                else resolve({ fingerprint })
            })
        })
    })

    ipcMain.handle(IPC_CHANNELS.certificates.load, async function(_event, { fingerprint }) {
        const cert = certificates.loadCertificate(fingerprint)
        return cert ? new Uint8Array(cert) : null
    })

    ipcMain.handle(IPC_CHANNELS.menu.setState, async function(_event, state) {
        menu.setState(state)
    })
}
