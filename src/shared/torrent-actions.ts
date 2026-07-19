export interface TorrentActionItem {
    id?: string
    label: string
    icon?: string
    role?: string
    action?: string
    checkProperty?: string
    accelerator?: string
    menu?: TorrentActionItem[]
}

const COMMON_ACCELERATORS: Record<string, string> = {
    "torrent-details": "CmdOrCtrl+D",
    "torrent-files": "CmdOrCtrl+Shift+D",
    recheck: "CmdOrCtrl+Shift+R",
    verify: "CmdOrCtrl+Shift+R",
    remove: "Delete",
    delete: "Delete",
    removeAndDelete: "CmdOrCtrl+Delete",
    removeAndLocal: "CmdOrCtrl+Delete",
    deleteAndRemove: "CmdOrCtrl+Delete",
    deleteAndErase: "CmdOrCtrl+Delete",
    removedatatorrent: "CmdOrCtrl+Delete",
}

/** Applies one shared shortcut policy without making runtimes depend on client ids. */
export function withTorrentActionAccelerators(actions: TorrentActionItem[]): TorrentActionItem[] {
    return actions.map((item) => ({
        ...item,
        accelerator: item.accelerator || COMMON_ACCELERATORS[item.id || item.action || ""],
        menu: item.menu ? withTorrentActionAccelerators(item.menu) : undefined,
    }))
}
