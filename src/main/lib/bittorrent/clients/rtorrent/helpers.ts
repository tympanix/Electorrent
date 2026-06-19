import { URL } from "node:url"

export const rtorrentFields = {
    trackers: {
        id: "t.id",
        group: "t.group",
        type: "t.type",
        url: "t.url",
        enabled: "t.is_enabled",
        open: "t.is_open",
        min_interval: "t.min_interval",
        normal_interval: "t.normal_interval",
        scrape_complete: "t.scrape_complete",
        scrape_downloaded: "t.scrape_downloaded",
        scrape_incomplete: "t.scrape_incomplete",
        scrape_time_last: "t.scrape_time_last",
    },
    torrents: {
        hash: "d.hash",
        torrent: "d.tied_to_file",
        torrentsession: "d.loaded_file",
        path: "d.base_path",
        name: "d.name",
        size: "d.size_bytes",
        skip: "d.skip.total",
        completed: "d.completed_bytes",
        completedAt: "d.timestamp.finished",
        down_rate: "d.down.rate",
        down_total: "d.down.total",
        up_rate: "d.up.rate",
        up_total: "d.up.total",
        message: "d.message",
        bitfield: "d.bitfield",
        chunk_size: "d.chunk_size",
        chunk_completed: "d.completed_chunks",
        createdAt: "d.creation_date",
        active: "d.is_active",
        open: "d.is_open",
        complete: "d.complete",
        hashing: "d.is_hash_checking",
        hashed: "d.is_hash_checked",
        leechers: "d.peers_accounted",
        seeders: "d.peers_complete",
        free_disk_space: "d.free_diskspace",
        left_bytes: "d.left_bytes",
        label: "d.custom1",
        addtime: "d.custom=addtime",
        loadDate: "d.load_date",
    },
}

export function postfix(param: string) {
    return param.includes("=") ? param : `${param}=`
}

export function urlHostname(trackerUrl: string) {
    try {
        return new URL(trackerUrl).hostname
    } catch {
        return undefined
    }
}

export function stringsToNumbers(object: Record<string, any>) {
    for (const key of Object.keys(object)) {
        if (key === "hash" || key === "name") {
            continue
        }

        const number = parseFloat(object[key])
        if (!Number.isNaN(number)) {
            object[key] = number
        }
    }
}

export function stringsToBooleans(object: Record<string, any>, keys: string[]) {
    for (const key of keys) {
        object[key] = !!parseInt(object[key], 10)
    }
}

export function arrayToHash(array: any[], keys: string[]) {
    const result: Record<string, any> = {}

    keys.forEach((key, index) => {
        result[key] = array[index]
    })

    return result
}

export function doubleArrayToHash(array: any[][], keys: string[]) {
    return array.map((item) => arrayToHash(item, keys))
}
