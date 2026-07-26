export type TorrentActionRole =
    | "start"
    | "stop"
    | "details"
    | "files"
    | "verify"
    | "set-location"
    | "set-label"
    | "set-speed-limits"
    | "set-ratio"
    | "remove"
    | "delete"

export interface TorrentActionItem {
    label: string
    icon?: string
    role?: TorrentActionRole
    action?: string
    checkProperty?: string
    accelerator?: string
    menu?: TorrentActionItem[]
}

const COMMON_ACCELERATORS: Partial<Record<TorrentActionRole, string>> = {
    start: "CmdOrCtrl+Alt+S",
    stop: "CmdOrCtrl+Alt+P",
    details: "CmdOrCtrl+D",
    files: "CmdOrCtrl+Shift+D",
    verify: "CmdOrCtrl+Shift+R",
    "set-label": "CmdOrCtrl+L",
    remove: "Delete",
    delete: "CmdOrCtrl+Delete",
}

/** Applies one shared shortcut policy using client-independent semantic roles. */
export function withTorrentActionAccelerators(actions: TorrentActionItem[]): TorrentActionItem[] {
    return actions.map((item) => ({
        ...item,
        accelerator: item.accelerator || (item.role && COMMON_ACCELERATORS[item.role]),
        menu: item.menu ? withTorrentActionAccelerators(item.menu) : undefined,
    }))
}
