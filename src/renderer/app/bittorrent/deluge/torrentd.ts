import {Torrent} from "../abstracttorrent";

export class DelugeTorrent extends Torrent {

    public state: string

    constructor(hash: string, data: Record<string, any>) {
        super({
            hash: hash, /* Hash (string): unique identifier for the torrent */
            name: data.name, /* Name (string): the name of the torrent */
            size: data.total_wanted, /* Size (integer): size of the file to be downloaded in bytes */
            percent: data.progress*10, /* Percent (integer): completion in per-mille (100% = 1000)  */
            downloaded: data.total_done, /* Downloaded (integer): number of bytes */
            uploaded: data.total_uploaded, /* Uploaded (integer): number of bytes */
            ratio: data.ratio, /* Ratio (integer): integer i per-mille (1:1 = 1000) */
            uploadSpeed: data.upload_payload_rate,  /* Upload Speed (integer): bytes per second */
            downloadSpeed: data.download_payload_rate, /* Download Speed (integer): bytes per second */
            eta: data.eta, /* ETA (integer): second to completion */
            label: undefined, /* Label (string): group/category identification */
            peersConnected: data.num_peers, /* Peers Connected (integer): number of peers connected */
            peersInSwarm: data.total_peers, /* Peers In Swarm (integer): number of peers in the swarm */
            seedsConnected: data.num_seeds, /* Seeds Connected (integer): number of connected seeds */
            seedsInSwarm: data.total_seeds, /* Seeds In Swarm (integer): number of connected seeds in swarm */
            torrentQueueOrder: data.queue+1, /* Queue (integer): the number in the download queue */
            statusMessage: data.state, /* Status (string): the current status of the torrent (e.g. downloading)  */
            dateAdded: data.time_added*1000, /* Date Added (integer): number of milliseconds unix time */
            dateCompleted: undefined, /* Date Completed (integer): number of milliseconds unix time */
            savePath: data.save_path, /* Save Path (string): the path at which the downloaded content is saved */
        });

        /*
         * Additional data that does not match the default scheme above
         * may be added as extra fields. This can be done in the manner below
         */
        this.state = data.state
    }

    isStatusError(): boolean {
        return this.state === "Error"
    };

    isStatusStopped(): boolean {
        return this.state === "Paused"
    };

    isStatusQueued(): boolean {
        return this.state === "Queued"
    };

    isStatusCompleted(): boolean {
        return this.percent === 1000
    };

    isStatusDownloading(): boolean {
        return this.state === "Downloading"
    };

    isStatusSeeding() {
        return this.state === "Seeding"
    };

    isStatusPaused() {
        return false
    };

}
