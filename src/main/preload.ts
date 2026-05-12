import { clipboard, contextBridge, ipcRenderer } from "electron"

const { IPC_CHANNELS } = require("../common/ipc")

function invoke<T = unknown>(channel: string, payload?: any): Promise<T> {
    return ipcRenderer.invoke(channel, payload)
}

function subscribe<T = unknown>(channel: string, callback: (payload: T) => void) {
    const listener = (_event: Electron.IpcRendererEvent, payload: T) => callback(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld("electorrent", {
    app: {
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
        saveAll: (settings: unknown) => invoke(IPC_CHANNELS.settings.saveAll, { settings }),
        listThemes: () => invoke(IPC_CHANNELS.settings.listThemes),
    },
    launch: {
        getPending: () => invoke(IPC_CHANNELS.launch.getPending),
        onMagnets: (callback: (magnets: string[]) => void) => subscribe(IPC_CHANNELS.launch.magnets, callback),
        onTorrentFiles: (callback: (files: Array<{ type: "file"; data: Uint8Array; filename: string; askUploadOptions?: boolean }>) => void) => subscribe(IPC_CHANNELS.launch.torrentFiles, callback),
    },
    torrents: {
        openFiles: (askUploadOptions: boolean) => invoke(IPC_CHANNELS.torrents.openFiles, { askUploadOptions }),
    },
    bittorrent: {
        connect: (server: unknown) => invoke(IPC_CHANNELS.bittorrent.connect, { server }),
        disconnect: () => invoke(IPC_CHANNELS.bittorrent.disconnect),
        getSnapshot: (request?: unknown) => invoke(IPC_CHANNELS.bittorrent.getSnapshot, request || {}),
        addTorrentUrl: (request: unknown) => invoke(IPC_CHANNELS.bittorrent.addTorrentUrl, request),
        uploadTorrent: (request: unknown) => invoke(IPC_CHANNELS.bittorrent.uploadTorrent, request),
        invokeAction: (request: unknown) => invoke(IPC_CHANNELS.bittorrent.invokeAction, request),
        getTorrentFiles: (request: unknown) => invoke(IPC_CHANNELS.bittorrent.getTorrentFiles, request),
        setTorrentFileSelection: (request: unknown) => invoke(IPC_CHANNELS.bittorrent.setTorrentFileSelection, request),
    },
    updates: {
        check: (verbose?: boolean) => invoke(IPC_CHANNELS.updates.check, { verbose }),
        installDownloaded: () => invoke(IPC_CHANNELS.updates.installDownloaded),
        installAuto: () => invoke(IPC_CHANNELS.updates.installAuto),
        onStatus: (callback: (event: unknown) => void) => subscribe(IPC_CHANNELS.updates.status, callback),
    },
    certificates: {
        fetch: (request: unknown) => invoke(IPC_CHANNELS.certificates.fetch, request),
        install: (request: unknown) => invoke(IPC_CHANNELS.certificates.install, request),
        load: (fingerprint: string) => invoke(IPC_CHANNELS.certificates.load, { fingerprint }),
        onChallenge: (callback: (prompt: unknown) => void) => subscribe(IPC_CHANNELS.certificates.challenge, callback),
    },
    notifications: {
        onPush: (callback: (notification: unknown) => void) => subscribe(IPC_CHANNELS.notifications.push, callback),
    },
    menu: {
        setState: (state: unknown) => invoke(IPC_CHANNELS.menu.setState, state),
        onAction: (callback: (action: unknown) => void) => subscribe(IPC_CHANNELS.menu.action, callback),
    },
    clipboard: {
        readText: () => clipboard.readText(),
    },
})
