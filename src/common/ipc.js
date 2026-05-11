const IPC_CHANNELS = {
    app: {
        getMeta: "app:get-meta",
        getDefaultProtocolStatus: "app:get-default-protocol-status",
        setDefaultProtocolStatus: "app:set-default-protocol-status",
        quit: "app:quit",
        reportCorruptSettings: "app:report-corrupt-settings",
    },
    shell: {
        openExternal: "shell:open-external",
    },
    settings: {
        getAll: "settings:get-all",
        saveAll: "settings:save-all",
        listThemes: "settings:list-themes",
    },
    launch: {
        getPending: "launch:get-pending",
        magnets: "launch:magnets",
        torrentFiles: "launch:torrent-files",
    },
    torrents: {
        openFiles: "torrents:open-files",
        readFiles: "torrents:read-files",
    },
    updates: {
        check: "updates:check",
        installDownloaded: "updates:install-downloaded",
        installAuto: "updates:install-auto",
        status: "updates:status",
    },
    certificates: {
        fetch: "certificates:fetch",
        install: "certificates:install",
        load: "certificates:load",
        challenge: "certificates:challenge",
    },
    notifications: {
        push: "notifications:push",
    },
    menu: {
        setState: "menu:set-state",
        action: "menu:action",
    },
}

module.exports = {
    IPC_CHANNELS,
}
