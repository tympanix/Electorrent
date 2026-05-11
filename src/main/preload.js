const { clipboard, ipcRenderer } = require('electron')
const { IPC_CHANNELS } = require('./common/ipc')

function invoke(channel, payload) {
    return ipcRenderer.invoke(channel, payload)
}

function subscribe(channel, callback) {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
}

function subscribeLegacy(channel, callback, mapArgs) {
    const listener = (_event, ...args) => callback(mapArgs(...args))
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
}

window.electorrent = {
    app: {
        getMeta: () => invoke(IPC_CHANNELS.app.getMeta),
        getDefaultProtocolStatus: (protocol) => invoke(IPC_CHANNELS.app.getDefaultProtocolStatus, { protocol }),
        setDefaultProtocolStatus: (protocol, enabled) => invoke(IPC_CHANNELS.app.setDefaultProtocolStatus, { protocol, enabled }),
        quit: () => invoke(IPC_CHANNELS.app.quit),
        reportCorruptSettings: () => invoke(IPC_CHANNELS.app.reportCorruptSettings),
    },
    shell: {
        openExternal: (url) => invoke(IPC_CHANNELS.shell.openExternal, { url }),
    },
    settings: {
        getAll: () => invoke(IPC_CHANNELS.settings.getAll),
        saveAll: (settings) => invoke(IPC_CHANNELS.settings.saveAll, { settings }),
        listThemes: () => invoke(IPC_CHANNELS.settings.listThemes),
    },
    launch: {
        getPending: () => invoke(IPC_CHANNELS.launch.getPending),
        onMagnets: (callback) => {
            const unsubscribers = [
                subscribe(IPC_CHANNELS.launch.magnets, callback),
                subscribeLegacy('magnet', callback, (magnets) => magnets),
            ]
            return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
        },
        onTorrentFiles: (callback) => {
            const unsubscribers = [
                subscribe(IPC_CHANNELS.launch.torrentFiles, callback),
                subscribeLegacy('torrentfiles', callback, (data, filename, askUploadOptions) => ([{
                    type: 'file',
                    data: new Uint8Array(data),
                    filename,
                    askUploadOptions: !!askUploadOptions,
                }])),
            ]
            return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
        },
    },
    torrents: {
        openFiles: (askUploadOptions) => invoke(IPC_CHANNELS.torrents.openFiles, { askUploadOptions }),
    },
    updates: {
        check: (verbose) => invoke(IPC_CHANNELS.updates.check, { verbose }),
        installDownloaded: () => invoke(IPC_CHANNELS.updates.installDownloaded),
        installAuto: () => invoke(IPC_CHANNELS.updates.installAuto),
        onStatus: (callback) => subscribe(IPC_CHANNELS.updates.status, callback),
    },
    certificates: {
        fetch: (request) => invoke(IPC_CHANNELS.certificates.fetch, request),
        install: (request) => invoke(IPC_CHANNELS.certificates.install, request),
        load: (fingerprint) => invoke(IPC_CHANNELS.certificates.load, { fingerprint }),
        onChallenge: (callback) => subscribe(IPC_CHANNELS.certificates.challenge, callback),
    },
    notifications: {
        onPush: (callback) => subscribe(IPC_CHANNELS.notifications.push, callback),
    },
    menu: {
        setState: (state) => invoke(IPC_CHANNELS.menu.setState, state),
        onAction: (callback) => subscribe(IPC_CHANNELS.menu.action, callback),
    },
    clipboard: {
        readText: () => clipboard.readText(),
    },
}
