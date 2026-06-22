import {Torrent} from "@renderer/app/bittorrent/abstracttorrent";

interface UtorrentApiAdditionalData {
    seed_override?: number
    seed_ratio?: number
    [key: string]: any
}

interface UtorrentApiTorrent {
    hash: string
    status: number
    name: string
    size: number
    percent: number
    downloaded: number
    uploaded: number
    ratio: number
    uploadSpeed: number
    downloadSpeed: number
    eta: number
    label: string
    peersConnected: number
    peersInSwarm: number
    seedsConnected: number
    seedsInSwarm: number
    availability: number
    torrentQueueOrder: number
    remaining: number
    downloadUrl: string
    rssFeedUrl: string
    statusMessage: string
    streamId: string
    dateAdded: number
    dateCompleted: number
    appUpdateUrl: string
    savePath: string
    additionalData?: UtorrentApiAdditionalData
}

const apiPropertiesOrder: Array<keyof UtorrentApiTorrent> = [
    "hash",
    "status",
    "name",
    "size",
    "percent",
    "downloaded",
    "uploaded",
    "ratio",
    "uploadSpeed",
    "downloadSpeed",
    "eta",
    "label",
    "peersConnected",
    "peersInSwarm",
    "seedsConnected",
    "seedsInSwarm",
    "availability",
    "torrentQueueOrder",
    "remaining",
    "downloadUrl",
    "rssFeedUrl",
    "statusMessage",
    "streamId",
    "dateAdded",
    "dateCompleted",
    "appUpdateUrl",
    "savePath",
    "additionalData",
]

function parseUtorrentApiTorrent(data: any[]): UtorrentApiTorrent {
    const torrent: any = {}
    apiPropertiesOrder.forEach((property, index) => {
        torrent[property] = data[index]
    })
    return torrent as UtorrentApiTorrent
}

function parseRatioLimit(additionalData?: UtorrentApiAdditionalData): number | undefined {
    if (!additionalData?.seed_override) {
        return undefined
    }

    const seedRatio = Number(additionalData.seed_ratio)
    return Number.isFinite(seedRatio) ? seedRatio / 1000 : undefined
}

export class UtorrentTorrent extends Torrent {

    /* Custom/additional attributes */
    availability: number
    remaining: number
    downloadUrl: string
    streamId: string
    rssFeedUrl: string
    appUpdateUrl: string
    additionalData: UtorrentApiAdditionalData

    constructor(data: UtorrentApiTorrent) {

        super({
            hash: data.hash,
            name: data.name,
            size: data.size,
            percent: data.percent,
            downloaded: data.downloaded,
            uploaded: data.uploaded,
            ratio: (data.ratio / 1000),
            ratioLimit: parseRatioLimit(data.additionalData),
            uploadSpeed: data.uploadSpeed,
            downloadSpeed: data.downloadSpeed,
            eta: data.eta,
            label: data.label,
            peersConnected: data.peersConnected,
            peersInSwarm: data.peersInSwarm,
            seedsConnected: data.seedsConnected,
            seedsInSwarm: data.seedsInSwarm,
            torrentQueueOrder: data.torrentQueueOrder,
            statusMessage: data.statusMessage,
            dateAdded: data.dateAdded * 1000,
            dateCompleted: data.dateCompleted > 0 ? data.dateCompleted * 1000 : undefined,
            savePath: data.savePath}
        );

        this.status = data.status;
        this.availability = (data.availability / 65536);
        this.remaining = data.remaining;
        this.downloadUrl = data.downloadUrl;
        this.streamId = data.streamId;
        this.rssFeedUrl = data.rssFeedUrl;
        this.appUpdateUrl = data.appUpdateUrl;
        this.additionalData = data.additionalData || {};

    }

    static fromApiArray(data: any[]): UtorrentTorrent {
        return new UtorrentTorrent(parseUtorrentApiTorrent(data))
    }

    statusesMap = {
        1: 'started',
        2: 'checking',
        4: 'startaftercheck',
        8: 'checked',
        16: 'error',
        32: 'paused',
        64: 'queued',
        128: 'loaded'
    };

    statusesFlags = [1, 2, 4, 8, 16, 32, 64, 128].reverse();

    /* State helper attributes */
    statusesCached: string[]

    getStatusFlag(x: number) {
        /*jshint bitwise: false*/
        return(this.status & x) === x;
        /*jshint bitwise: true*/
    };

    getStatuses() {
        //var str = '';
        var i = 0;

        if(this.statusesCached) {
            return this.statusesCached;
        }
        var res = [];

        for(i = 0; i < this.statusesFlags.length; i++) {
            if(this.getStatusFlag(this.statusesFlags[i])) {
                res.push(this.statusesMap[this.statusesFlags[i]]);
            }
        }
        if(this.status > 255) {
            res.push('unknown');
        }

        if(this.percent === 1000) {
            res.push('completed');
        }

        this.statusesCached = res;

        return this.statusesCached;
    };

    isStatusStarted() {
        return this.getStatusFlag(1);
    };
    isStatusChecking() {
        return this.getStatusFlag(2);
    };

    isStatusStartAfterCheck() {
        return this.getStatusFlag(4);
    };

    isStatusChecked() {
        return this.getStatusFlag(8);
    };

    isStatusError() {
        return this.getStatusFlag(16);
    };

    isStatusPaused() {
        return this.getStatusFlag(32);
    };

    isStatusQueued() {
        return this.getStatusFlag(64) && !this.isStatusDownloading();
    };

    isStatusLoaded() {
        return this.getStatusFlag(128);
    };

    isStatusCompleted() {
        return(this.percent === 1000);
    };

    isStatusDownloading() {
        return this.getStatusFlag(64) && this.percent !== 1000;
    };

    isStatusSeeding() {
        return this.isStatusStarted() && (this.isStatusCompleted());
    };

    isStatusStopped() {
        return(!this.getStatusFlag(64)) && (!this.isStatusCompleted());
    };

}