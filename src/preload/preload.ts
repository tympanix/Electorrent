import { contextBridge, ipcRenderer, webUtils } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc'
import type { ColorTheme, ElectorrentBridge, PendingTorrentUploadFile, PendingTorrentUploadLink } from '@shared/ipc-contract'
import type { TitleMenuItem } from '@shared/title-menu'

const INITIAL_THEME_ARGUMENT = '--theme='
const initialThemeArgument = process.argv.find((argument) => argument.startsWith(INITIAL_THEME_ARGUMENT))
const initialThemeValue = initialThemeArgument?.slice(INITIAL_THEME_ARGUMENT.length)
const initialTheme: ColorTheme = initialThemeValue === 'dark' ? 'dark' : 'light'
const nodeEnvironment = process.env["NODE" + "_ENV"]

function invoke<T = unknown>(channel: string, payload?: unknown): Promise<T> {
    return ipcRenderer.invoke(channel, payload)
}

function subscribe<T = unknown>(channel: string, callback: (payload: T) => void) {
    const listener = (_event: Electron.IpcRendererEvent, payload: T) => callback(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
}

const electorrentBridge: ElectorrentBridge = {
    app: {
        initialTheme,
        isTestEnvironment: nodeEnvironment === 'test',
        getMeta: () => invoke(IPC_CHANNELS.app.getMeta),
        getDefaultProtocolStatus: (protocol: string) => invoke(IPC_CHANNELS.app.getDefaultProtocolStatus, { protocol }),
        setDefaultProtocolStatus: (protocol: string, enabled: boolean) => invoke(IPC_CHANNELS.app.setDefaultProtocolStatus, { protocol, enabled }),
        quit: () => invoke(IPC_CHANNELS.app.quit),
        reportCorruptSettings: () => invoke(IPC_CHANNELS.app.reportCorruptSettings),
    },
    shell: {
        openExternal: (url: string) => invoke(IPC_CHANNELS.shell.openExternal, { url }),
    },
    settings: {
        getAll: () => invoke(IPC_CHANNELS.settings.getAll),
        saveAll: (settings) => invoke(IPC_CHANNELS.settings.saveAll, { settings }),
        listThemes: () => invoke(IPC_CHANNELS.settings.listThemes),
        getSystemTheme: () => invoke(IPC_CHANNELS.settings.getSystemTheme),
        onSystemThemeChanged: (callback: (theme: ColorTheme) => void) => subscribe(IPC_CHANNELS.settings.systemThemeChanged, callback),
        chooseWatchDirectory: (currentPath?: string) => invoke(IPC_CHANNELS.settings.chooseWatchDirectory, { currentPath }),
    },
    launch: {
        getPending: () => invoke(IPC_CHANNELS.launch.getPending),
        onMagnets: (callback: (magnets: PendingTorrentUploadLink[]) => void) => subscribe(IPC_CHANNELS.launch.magnets, callback),
        onTorrentFiles: (callback: (files: PendingTorrentUploadFile[]) => void) => subscribe(IPC_CHANNELS.launch.torrentFiles, callback),
    },
    torrents: {
        openFiles: (askUploadOptions: boolean) => invoke(IPC_CHANNELS.torrents.openFiles, { askUploadOptions }),
        parse: (request) => invoke(IPC_CHANNELS.torrents.parse, request),
        getPathForFile: (file) => webUtils.getPathForFile(file),
    },
    bittorrent: {
        connect: (server) => invoke(IPC_CHANNELS.bittorrent.connect, { server }),
        disconnect: () => invoke(IPC_CHANNELS.bittorrent.disconnect),
        getSnapshot: (request) => invoke(IPC_CHANNELS.bittorrent.getSnapshot, request || {}),
        addTorrentUrl: (request) => invoke(IPC_CHANNELS.bittorrent.addTorrentUrl, request),
        uploadTorrent: (request) => invoke(IPC_CHANNELS.bittorrent.uploadTorrent, request),
        invokeAction: (request) => invoke(IPC_CHANNELS.bittorrent.invokeAction, request),
        getActions: () => invoke(IPC_CHANNELS.bittorrent.getActions),
        setSelectedTorrents: (hashes) => invoke(IPC_CHANNELS.bittorrent.setSelectedTorrents, { hashes }),
        getTorrentDetails: (request) => invoke(IPC_CHANNELS.bittorrent.getTorrentDetails, request),
        getTorrentFiles: (request) => invoke(IPC_CHANNELS.bittorrent.getTorrentFiles, request),
        getTorrentPeers: (request) => invoke(IPC_CHANNELS.bittorrent.getTorrentPeers, request),
        getTorrentTrackers: (request) => invoke(IPC_CHANNELS.bittorrent.getTorrentTrackers, request),
        setTorrentFileSelection: (request) => invoke(IPC_CHANNELS.bittorrent.setTorrentFileSelection, request),
    },
    updates: {
        check: (verbose?: boolean) => invoke(IPC_CHANNELS.updates.check, { verbose }),
        installDownloaded: () => invoke(IPC_CHANNELS.updates.installDownloaded),
        installAuto: () => invoke(IPC_CHANNELS.updates.installAuto),
        onStatus: (callback) => subscribe(IPC_CHANNELS.updates.status, callback),
    },
    certificates: {
        fetch: (request) => invoke(IPC_CHANNELS.certificates.fetch, request),
        install: (request) => invoke(IPC_CHANNELS.certificates.install, request),
        load: (fingerprint: string) => invoke(IPC_CHANNELS.certificates.load, { fingerprint }),
        onChallenge: (callback) => subscribe(IPC_CHANNELS.certificates.challenge, callback),
    },
    notifications: {
        onPush: (callback) => subscribe(IPC_CHANNELS.notifications.push, callback),
    },
    edit: {
        command: (command) => invoke(IPC_CHANNELS.edit.command, { command }),
    },
    window: {
        command: (command) => invoke(IPC_CHANNELS.window.command, { command }),
    },
    menu: {
        getModel: () => invoke<TitleMenuItem[]>(IPC_CHANNELS.menu.getModel),
        onChanged: (callback: (menu: TitleMenuItem[]) => void) => subscribe(IPC_CHANNELS.menu.changed, callback),
        onAction: (callback) => subscribe(IPC_CHANNELS.menu.action, callback),
    },
    clipboard: {
        readText: () => invoke(IPC_CHANNELS.clipboard.readText),
        writeText: (text: string) => invoke(IPC_CHANNELS.clipboard.writeText, { text }),
    },
}

contextBridge.exposeInMainWorld('electorrent', electorrentBridge)
