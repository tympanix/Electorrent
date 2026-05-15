import { app, ipcMain, shell, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'

const is = require('electron-is')
const { IPC_CHANNELS } = require('../../common/ipc')
const { bittorrentManager } = require('./bittorrent')
const config = require('./config')
const updater = require('./update')
const torrents = require('./torrents')
const themes = require('./themes')
const certificates = require('./certificates')
const menu = require('./menu')

interface RegisterHandlersOptions {
    isDebug: boolean
    getWindow: () => BrowserWindow | null
    consumePendingLaunchPayload: () => Promise<{
        magnets: string[]
        torrentFiles: unknown[]
    }>
}

function getAppMeta(isDebug: boolean) {
    return {
        appName: app.name,
        appVersion: app.getVersion(),
        isMacOS: is.macOS(),
        isWindows: is.windows(),
        isLinux: is.linux(),
        isDebug,
        platform: process.platform,
        versions: {
            node: process.versions.node,
            chrome: process.versions.chrome,
            electron: process.versions.electron,
        },
    }
}

exports.registerHandlers = function({ isDebug, getWindow, consumePendingLaunchPayload }: RegisterHandlersOptions) {
    ipcMain.handle(IPC_CHANNELS.app.getMeta, async function() {
        return getAppMeta(isDebug)
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
        return consumePendingLaunchPayload()
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

                const window = getWindow()
                if (window && !window.isDestroyed()) {
                    window.webContents.send(IPC_CHANNELS.certificates.challenge, cert)
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
}
