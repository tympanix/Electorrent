import {Torrent} from "../abstracttorrent";

export class RtorrentTorrent extends Torrent {

    active: boolean;
    checked: boolean;
    checking: boolean;
    open: boolean;
    complete: boolean;
    message: string;
    tracker: string;
    trackers: string[];

    constructor(data: Record<string, any>) {

        super({
            hash: data.hash, /* Hash (string): unique identifier for the torrent */
            name: data.name, /* Name (string): the name of the torrent */
            size: data.size, /* Size (integer): size of the file to be downloaded in bytes */
            downloaded: data.down_total, /* Downloaded (integer): number of bytes */
            percent: data.down_total / data.size * 1000, /* Percent (integer): completion in per-mille (100% = 1000)  */
            uploaded: data.up_total, /* Uploaded (integer): number of bytes */
            ratio: data.ratio, /* Ratio (integer): integer i per-mille (1:1 = 1000) */
            uploadSpeed: data.up_rate,  /* Upload Speed (integer): bytes per second */
            downloadSpeed: data.down_rate, /* Download Speed (integer): bytes per second */
            eta: undefined, /* ETA (integer): second to completion MISSING */
            label: data.label, /* Label (string): group/category identification MISSING */
            peersConnected: data.leechers, /* Peers Connected (integer): number of peers connected */
            peersInSwarm: data.leechers_total, /* Peers In Swarm (integer): number of peers in the swarm */
            seedsConnected: data.seeders, /* Seeds Connected (integer): number of connected seeds */
            seedsInSwarm: data.seeders_total, /* Seeds In Swarm (integer): number of connected seeds in swarm */
            torrentQueueOrder: undefined, /* Queue (integer): the number in the download queue */
            statusMessage: undefined, /* Status (string): the current status of the torrent (e.g. downloading)  */
            dateAdded: data.addtime * 1000, /* Date Added (integer): number of milliseconds unix time */
            dateCompleted: data.completed, /* Date Completed (integer): number of milliseconds unix time */
            savePath: data.directory, /* Save Path (string): the path at which the downloaded content is saved */
        });

        /*
         * Additional data that does not match the default scheme above
         * may be added as extra fields. This can be done in the manner below
         */
        this.status = data.get_state
        this.active = data.active
        this.checked = data.hashed
        this.checking = data.hashing
        this.open = data.open
        this.complete = data.complete
        this.message = data.message
        this.tracker = data.tracker
        this.trackers = data.trackers

        this.eta = data.left_bytes / this.downloadSpeed
    }


    isStatusError(): boolean {
        return (!!this.message)
    };

    isStatusStopped(): boolean {
        return (
            !this.active &&
            !this.open &&
            !this.checking &&
            !this.checked &&
            !this.complete
        );
    };

    isStatusQueued(): boolean {
        return false
    };

    isStatusCompleted(): boolean {
        return (
            !this.active &&
            this.complete
        )
    };

    isStatusDownloading(): boolean {
        return (
            this.open &&
            this.active &&
            this.checked &&
            !this.complete
        )
    };

    isStatusSeeding(): boolean {
        return (
            this.active &&
            this.open &&
            this.complete
        )
    };

    isStatusPaused(): boolean {
        return (
            this.open &&
            !this.active &&
            !this.complete
        )
    };


    isStatusSeedPaused(): boolean {
        return (
            this.open &&
            this.checked &&
            this.complete &&
            !this.active
        )
    };

    isStatusChecking(): boolean {
        return !!this.checking
    }

    statusColor(): string {
        if (this.isStatusChecking()){
            return 'grey';
        } else if (this.isStatusSeeding()){
            return 'orange';
        } else if (this.isStatusError()){
            return 'error';
        } else if (this.isStatusDownloading()){
            return 'blue';
        } else if (this.isStatusPaused() || this.isStatusSeedPaused()){
            return 'grey';
        } else if (this.isStatusCompleted()){
            return 'success';
        } else {
            return 'disabled';
        }
    };

    statusText(): string {
        if (this.isStatusChecking()) {
            return 'Checking';
        } else if (this.isStatusSeeding()){
            return 'Seeding';
        } else if (this.isStatusError()){
            return 'Error';
        } else if (this.isStatusSeedPaused()){
            return 'Paused Seed';
        } else if (this.isStatusDownloading()){
            return 'Downloading';
        } else if (this.isStatusCompleted()){
            return 'Completed';
        } else if (this.isStatusPaused()){
            return 'Paused';
        } else if (this.isStatusStopped()){
            return 'Stopped';
        } else {
            return 'Unknown';
        }
    };

}
