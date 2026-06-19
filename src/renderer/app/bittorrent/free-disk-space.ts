import type { TorrentUpdates } from "./torrentclient"

export function normalizeFreeDiskSpace(value: unknown): number | null | undefined {
    if (value === undefined) {
        return undefined
    }

    if (value === null) {
        return null
    }

    const numeric = typeof value === "number" ? value : Number(value)
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : null
}

export function applyFreeDiskSpace(updates: TorrentUpdates, value: unknown): TorrentUpdates {
    const freeDiskSpace = normalizeFreeDiskSpace(value)

    if (freeDiskSpace !== undefined) {
        updates.freeDiskSpace = freeDiskSpace
    }

    return updates
}
