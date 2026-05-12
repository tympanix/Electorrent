const { IPC_CHANNELS } = require('../common/ipc')

type PendingLaunchPayload = {
    magnets: string[]
    torrentFilePaths: string[]
}

type IpcDependencies = {
    app: Electron.App
    ipcMain: Electron.IpcMain
    shell: Electron.Shell
    config: any
    themes: any
    torrents: any
    bittorrentManager: any
    updater: any
    certificates: any
    menu: any
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
        return new Promise((resolve, reject) => {
            config.saveAll(settings, function(err) {
                if (err) reject(err)
                else resolve(undefined)
            })
        })
    })

    ipcMain.handle(IPC_CHANNELS.settings.listThemes, async function() {
        return themes()
    })

    ipcMain.handle(IPC_CHANNELS.launch.getPending, async function() {
        return {
            magnets: pendingLaunchPayload.magnets.splice(0),
            torrentFiles: await torrents.readFiles(pendingLaunchPayload.torrentFilePaths.splice(0), false),
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
