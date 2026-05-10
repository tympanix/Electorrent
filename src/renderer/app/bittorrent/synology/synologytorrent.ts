import {Torrent} from "../abstracttorrent";

export class SynologyTorrent extends Torrent {

    constructor(data: Record<string, any>) {
        // Information variables.
        var detail = data.additional.detail;
        var trans = data.additional.transfer;
        var track = data.additional.tracker;

        super({
            hash: data.id, /* Hash (string): unique identifier for the torrent */
            name: data.title, /* Name (string): the name of the torrent */
            size: data.size, /* Size (integer): size of the file to be downloaded in bytes */
            percent: (trans.size_downloaded / data.size) * 1000, /* Percent (integer): completion in per-mille (100% = 1000)  */
            downloaded: trans.size_downloaded, /* Downloaded (integer): number of bytes */
            uploaded: trans.size_uploaded, /* Uploaded (integer): number of bytes */
            ratio: (trans.size_uploaded / trans.size_downloaded), /* Ratio (integer): integer i per-mille (1:1 = 1000) */
            uploadSpeed: trans.speed_upload,  /* Upload Speed (integer): bytes per second */
            downloadSpeed: trans.speed_download, /* Download Speed (integer): bytes per second */
            eta: SynologyTorrent.etaCalc(data, data.additional.transfer), /* ETA (integer): second to completion */
            label: '', /* Label (string): group/category identification */
            peersConnected: detail.connected_peers, /* Peers Connected (integer): number of peers connected */
            peersInSwarm: SynologyTorrent.trackCount(data.additional.tracker, t => t.peers), /* Peers In Swarm (integer): number of peers in the swarm */
            seedsConnected: detail.connected_seeders, /* Seeds Connected (integer): number of connected seeds */
            seedsInSwarm: SynologyTorrent.trackCount(data.additional.tracker, t => t.seeds), /* Seeds In Swarm (integer): number of connected seeds in swarm */
            torrentQueueOrder: 0, /* Queue (integer): the number in the download queue */
            statusMessage: data.status, /* Status (string): the current status of the torrent (e.g. downloading)  */
            dateAdded: detail.create_time * 1000, /* Date Added (integer): number of milliseconds unix time */
            dateCompleted: detail.completed_time * 1000, /* Date Completed (integer): number of milliseconds unix time */
            savePath: detail.destination, /* Save Path (string): the path at which the downloaded content is saved */
        });
    }

    // Calculates the total amount of peers and seeds over all connected trackers.
    // Takes a map function from peersInSwarm and seedsInSwarm to get the correct numbers.
    static trackCount(track: Record<string, any>, mapFun: (e: any) => any): number {
        if (!track || track.length === 0) {
            return 0;
        }
        var numArr = track.map(mapFun)
        return numArr.reduce((acc: number, curr: number) => acc + curr);
    }

    // Roughly calculates the ETA each update from the server.
    static etaCalc(data: any, trans: any) {
        var remain = data.size - trans.size_downloaded;
        return remain / trans.speed_download;
    }


    /**
     * Returns whether this torrent is in an error state. Torrents in this group shows
     * up in the 'Error' tab in the GUI
     * @return {boolean} isStatusError
     */
    isStatusError(): boolean {
        return this.statusMessage === "error";
    };

    /**
     * Returns whether this torrent is stopped. Torrents in this group shows up in
     * the 'Stopped' tab to the left in the GUI
     * @return {boolean} isStatusStopped
     */
    isStatusStopped(): boolean {
        return (this.statusMessage === "paused") && (this.percent !== 1000);
    };

    /**
     * Returns whether this torrent is in queue for downloading. Torrents in this group shows up
     * in the same tab as 'Downloading' in the GUI
     * @return {boolean} isStatusQueue
     */
    isStatusQueued(): boolean {
        return
    };

    /**
     * Returns whether this torrent is completed. Usually this can be done by
     * checking whether this.percent === 1000 which means 100%. Torrents in this group
     * shows up the 'Finished' tab in the GUI
     * @return {boolean} isStatusCompleted
     */
    isStatusCompleted(): boolean {
        return (this.statusMessage === "finished") || ((this.statusMessage === "paused") && (this.percent === 1000)) ;
    };

    /**
     * Returns whether this torrent is downloading. Torrents in this group
     * shows up the 'Downloading' tab in the GUI
     * @return {boolean} isStatusDownloading
     */
    isStatusDownloading(): boolean {
        return this.statusMessage === "downloading";
    };

    /**
     * Returns whether this torrent is seeding. Torrents in this group
     * shows up the 'Seeding' tab in the GUI
     * @return {boolean} isStatusDownloading
     */
    isStatusSeeding(): boolean {
        return this.statusMessage === "seeding";
    };

    /**
     * Returns whether this torrent is paused. Torrents in this group
     * shows up in the same tab as the 'Downloading' tab in the GUI.
     * @return {boolean} isStatusDownloading
     */
    isStatusPaused(): boolean {
        return
    };

    /**
     * Optionally returns the color for the progress bar used as a class in CSS.
     * Colors are decided by default using the status functions above. Only implement
     * this when having color issues.
     * @return {string} color
     */
    statusColor(): string {
        if (this.isStatusError()) {
            return 'error';
        } else if (this.isStatusStopped()) {
            return 'grey';
        } else if (this.isStatusCompleted()) {
            return 'success';
        } else if (this.isStatusDownloading()) {
            return 'blue';
        } else if (this.isStatusSeeding()) {
            return 'orange';
        } else {
            return 'disabled';
        }
    };

    /**
     * Optionally returns the status of the torrent. The status is by default
     * computed using the.statusMessage. Only implement this when having trouble with
     * incorrect status messages in the GUI
     * @return {string} status
     */
    statusText(): string {
        if (this.isStatusError()) {
            return 'Error';
        } else if (this.isStatusStopped()) {
            return 'Paused';
        } else if (this.isStatusCompleted()) {
            return 'Finished';
        } else if (this.isStatusDownloading()) {
            return 'Downloading';
        } else if (this.isStatusSeeding()) {
            return 'Seeding';
        } else {
            return 'Waiting';
        }
    };

}