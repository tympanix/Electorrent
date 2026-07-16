export const IPC_CHANNELS = {
    app: {
        getMeta: 'app:get-meta',
        getDefaultProtocolStatus: 'app:get-default-protocol-status',
        setDefaultProtocolStatus: 'app:set-default-protocol-status',
        quit: 'app:quit',
        reportCorruptSettings: 'app:report-corrupt-settings',
    },
    shell: {
        openExternal: 'shell:open-external',
    },
    settings: {
        getAll: 'settings:get-all',
        saveAll: 'settings:save-all',
        listThemes: 'settings:list-themes',
        getSystemTheme: 'settings:get-system-theme',
        systemThemeChanged: 'settings:system-theme-changed',
        chooseWatchDirectory: 'settings:choose-watch-directory',
    },
    launch: {
        getPending: 'launch:get-pending',
        magnets: 'launch:magnets',
        torrentFiles: 'launch:torrent-files',
    },
    torrents: {
        openFiles: 'torrents:open-files',
        parse: 'torrents:parse',
    },
    bittorrent: {
        connect: 'bittorrent:connect',
        disconnect: 'bittorrent:disconnect',
        getSnapshot: 'bittorrent:get-snapshot',
        addTorrentUrl: 'bittorrent:add-torrent-url',
        uploadTorrent: 'bittorrent:upload-torrent',
        invokeAction: 'bittorrent:invoke-action',
        getTorrentDetails: 'bittorrent:get-torrent-details',
        getTorrentFiles: 'bittorrent:get-torrent-files',
        setTorrentFileSelection: 'bittorrent:set-torrent-file-selection',
    },
    updates: {
        check: 'updates:check',
        installDownloaded: 'updates:install-downloaded',
        installAuto: 'updates:install-auto',
        status: 'updates:status',
    },
    certificates: {
        fetch: 'certificates:fetch',
        install: 'certificates:install',
        load: 'certificates:load',
        challenge: 'certificates:challenge',
    },
    notifications: {
        push: 'notifications:push',
    },
    edit: {
        command: 'edit:command',
    },
    window: {
        command: 'window:command',
    },
    menu: {
        action: 'menu:action',
        getModel: 'menu:get-model',
        changed: 'menu:changed',
    },
    clipboard: {
        readText: 'clipboard:read-text',
    },
} as const
