import { app, dialog, ipcMain, shell, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import is from 'electron-is'

import { IPC_CHANNELS } from '@shared/ipc'
import type { AppSettings } from '@shared/ipc-contract'
import { bittorrentManager } from './bittorrent'
import * as certificates from './certificates'
import * as menu from './menu'
import * as settings from './settings'
import themes from './themes'
import * as torrents from './torrents'
import * as updater from './update'

interface RegisterHandlersOptions {
    isDebug: boolean
    getWindow: () => BrowserWindow | null
    consumePendingLaunchPayload: () => Promise<{
        magnets: string[]
        torrentFiles: unknown[]
    }>
    onSettingsSaved?: (settings: AppSettings) => void | Promise<void>
    onBittorrentConnected?: () => void | Promise<void>
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

export function registerHandlers({ isDebug, getWindow, consumePendingLaunchPayload, onSettingsSaved, onBittorrentConnected }: RegisterHandlersOptions) {
    menu.configure({ isDebug })

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
        settings.showCorruptDialog()
    })

    ipcMain.handle(IPC_CHANNELS.shell.openExternal, async function(_event: IpcMainInvokeEvent, { url }) {
        await shell.openExternal(url)
    })

    ipcMain.handle(IPC_CHANNELS.settings.getAll, async function() {
        return settings.getAllSettings()
    })

    ipcMain.handle(IPC_CHANNELS.settings.saveAll, async function(_event: IpcMainInvokeEvent, { settings: newSettings }) {
        await new Promise<void>((resolve, reject) => {
            settings.saveAll(newSettings, function(err: Error) {
                if (err) {
                    reject(err)
                    return
                }
                resolve()
            })
        })

        menu.refresh()
        await onSettingsSaved?.(newSettings)
    })

    ipcMain.handle(IPC_CHANNELS.settings.listThemes, async function() {
        return themes()
    })

    ipcMain.handle(IPC_CHANNELS.settings.chooseWatchDirectory, async function(_event: IpcMainInvokeEvent, { currentPath }) {
        const window = getWindow()
        const result = await dialog.showOpenDialog(window || undefined, {
            title: 'Choose Folder to Watch',
            defaultPath: typeof currentPath === 'string' && currentPath ? currentPath : undefined,
            buttonLabel: 'Use Folder',
            properties: ['openDirectory', 'createDirectory'],
        })

        if (result.canceled || result.filePaths.length === 0) {
            return null
        }

        return result.filePaths[0]
    })

    ipcMain.handle(IPC_CHANNELS.launch.getPending, async function() {
        return consumePendingLaunchPayload()
    })

    ipcMain.handle(IPC_CHANNELS.torrents.openFiles, async function(_event: IpcMainInvokeEvent, { askUploadOptions }) {
        return torrents.browse(askUploadOptions)
    })

    ipcMain.handle(IPC_CHANNELS.bittorrent.connect, async function(event: IpcMainInvokeEvent, { server }) {
        await bittorrentManager.connect(event.sender, server)
        menu.setActiveServer(server)
        await onBittorrentConnected?.()
    })

    ipcMain.handle(IPC_CHANNELS.bittorrent.disconnect, async function(event: IpcMainInvokeEvent) {
        await bittorrentManager.disconnect(event.sender)
        menu.setActiveServer(null)
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

    ipcMain.handle(IPC_CHANNELS.bittorrent.getTorrentDetails, async function(event: IpcMainInvokeEvent, { hash }) {
        return bittorrentManager.getTorrentDetails(event.sender, hash)
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
}
