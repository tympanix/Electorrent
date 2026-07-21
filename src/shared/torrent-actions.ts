export type TorrentActionRole =
    | "details"
    | "files"
    | "verify"
    | "set-location"
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
    details: "CmdOrCtrl+D",
    files: "CmdOrCtrl+Shift+D",
    verify: "CmdOrCtrl+Shift+R",
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
