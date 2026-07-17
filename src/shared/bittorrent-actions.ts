export interface TorrentSpeedLimitOptions {
    downloadSpeedLimit?: number
    uploadSpeedLimit?: number
}

export interface TorrentRatioLimitOptions {
    ratioLimit: number
}

export interface MockTorrentFileInput {
    index: number
    name: string
    size: number
    progress: number
    availability: number
    priority: number
    is_seed: boolean
}

export interface MockTorrentInput {
    added_on?: number
    category?: string
    completion_on?: number
    dl_speed?: number
    eta?: number
    hash?: string
    name?: string
    num_complete?: number
    num_incomplete?: number
    num_leechs?: number
    num_seeds?: number
    priority?: number
    progress?: number
    ratio?: number
    ratio_limit?: number
    save_path?: string
    seq_dl?: boolean
    size?: number
    state?: string
    total_downloaded?: number
    total_size?: number
    total_uploaded?: number
    up_speed?: number
    files?: MockTorrentFileInput[]
}

/** Arguments passed after the common torrent-hash array for each dispatchable action. */
export interface BittorrentActionArguments {
    addMockedTorrent: [input?: MockTorrentInput]
    bottomPrio: []
    clearMockedTorrents: []
    decreasePrio: []
    delete: []
    deleteAndErase: []
    deleteAndRemove: []
    forcestart: []
    getprops: []
    increasePrio: []
    label: [label: string]
    pause: []
    pauseAll: []
    priorityHigh: []
    priorityLow: []
    priorityNormal: []
    priorityOff: []
    queueBottom: []
    queueDown: []
    queueTop: []
    queueUp: []
    queuedown: []
    queueup: []
    recheck: []
    remove: []
    removeAndDelete: []
    removeAndLocal: []
    removedata: []
    removedatatorrent: []
    removetorrent: []
    resume: []
    resumeAll: []
    setAlternativeSpeedLimitsMode: [enabled: boolean]
    setCategory: [category: string, create?: boolean]
    setLabel: [label: string, create?: boolean]
    setLocation: [location: string, resumeHashes?: string[]]
    setRatioLimit: [options: TorrentRatioLimitOptions]
    setSpeedLimits: [options: TorrentSpeedLimitOptions]
    start: []
    stop: []
    toggleSequentialDownload: []
    topPrio: []
    verify: []
}

export type BittorrentActionName = keyof BittorrentActionArguments

const BITTORRENT_ACTIONS = {
    addMockedTorrent: true,
    bottomPrio: true,
    clearMockedTorrents: true,
    decreasePrio: true,
    delete: true,
    deleteAndErase: true,
    deleteAndRemove: true,
    forcestart: true,
    getprops: true,
    increasePrio: true,
    label: true,
    pause: true,
    pauseAll: true,
    priorityHigh: true,
    priorityLow: true,
    priorityNormal: true,
    priorityOff: true,
    queueBottom: true,
    queueDown: true,
    queueTop: true,
    queueUp: true,
    queuedown: true,
    queueup: true,
    recheck: true,
    remove: true,
    removeAndDelete: true,
    removeAndLocal: true,
    removedata: true,
    removedatatorrent: true,
    removetorrent: true,
    resume: true,
    resumeAll: true,
    setAlternativeSpeedLimitsMode: true,
    setCategory: true,
    setLabel: true,
    setLocation: true,
    setRatioLimit: true,
    setSpeedLimits: true,
    start: true,
    stop: true,
    toggleSequentialDownload: true,
    topPrio: true,
    verify: true,
} as const satisfies Record<BittorrentActionName, true>

export type BittorrentInvokeActionRequest<Action extends BittorrentActionName = BittorrentActionName> = {
    [Name in Action]: {
        action: Name
        hashes?: string[]
        args?: BittorrentActionArguments[Name]
    }
}[Action]

export function isBittorrentActionName(action: unknown): action is BittorrentActionName {
    return typeof action === "string" && Object.prototype.hasOwnProperty.call(BITTORRENT_ACTIONS, action)
}
