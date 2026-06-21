import {Torrent} from "@renderer/app/bittorrent/abstracttorrent";

export class TransmissionTorrent extends Torrent {
    private static STATUS_STOPPED = 0
    private static STATUS_CHECK_WAIT = 1
    private static STATUS_CHECK = 2
    private static STATUS_DOWNLOAD_WAIT = 3
    private static STATUS_DOWNLOAD = 4
    private static STATUS_SEED_WAIT = 5
    private static STATUS_SEED = 6

    data: Record<string, any>
    error: number
    labels: string[]
    trackers: string[]

    constructor(data: Record<string, any>) {
        super({
            hash: data.hashString, /* Hash (string): unique identifier for the torrent */
            name: data.name, /* Name (string): the name of the torrent */
            size: data.totalSize, /* Size (integer): size of the file to be downloaded in bytes */
            percent: data.percentDone * 1000, /* Percent (integer): completion in per-mille (100% = 1000)  */
            downloaded: data.downloadedEver, /* Downloaded (integer): number of bytes */
            uploaded: data.uploadedEver, /* Uploaded (integer): number of bytes */
            ratio: data.uploadRatio, /* Ratio (integer): integer i per-mille (1:1 = 1000) */
            ratioLimit: data.seedRatioMode > 0 ? data.seedRatioLimit : undefined,
            uploadSpeed: data.rateUpload,  /* Upload Speed (integer): bytes per second */
            downloadSpeed: data.rateDownload, /* Download Speed (integer): bytes per second */
            uploadLimit: data.uploadLimited ? data.uploadLimit * 1024 : 0,
            downloadLimit: data.downloadLimited ? data.downloadLimit * 1024 : 0,
            eta: data.eta, /* ETA (integer): second to completion */
            label: data.labels?.[0] || "", /* Label (string): group/category identification */
            peersConnected: data.peersSendingToUs, /* Peers Connected (integer): number of peers connected */
            peersInSwarm: data.peersConnected, /* Peers In Swarm (integer): number of peers in the swarm */
            seedsConnected: data.peersGettingFromUs, /* Seeds Connected (integer): number of connected seeds */
            seedsInSwarm: data.peersConnected, /* Seeds In Swarm (integer): number of connected seeds in swarm */
            torrentQueueOrder: data.queuePosition, /* Queue (integer): the number in the download queue */
            statusMessage: '', /* Status (string): the current status of the torrent (e.g. downloading)  */
            dateAdded: data.addedDate * 1000, /* Date Added (integer): number of milliseconds unix time */
            dateCompleted: data.doneDate > 0 ? data.doneDate * 1000 : undefined, /* Date Completed (integer): number of milliseconds unix time */
            savePath: data.downloadDir, /* Save Path (string): the path at which the downloaded content is saved */
        });

        this.data = data;


        this.status = data.status;
        this.error = data.error;
        this.labels = Array.isArray(data.labels) ? data.labels : []
        this.trackers = data.trackers.map((tracker: Record<string, any>) => tracker.announce)

        // Extra Field: Recheck Progress aka Verifying.
        if(this.isStatusVerifying()) {
            this.percent = data.recheckProgress * 1000;
        }

    }

    isStatusVerifying(): boolean {
        return this.status === TransmissionTorrent.STATUS_CHECK;
    };

    isStatusQueuedToVerify(): boolean {
        return this.status === TransmissionTorrent.STATUS_CHECK_WAIT;
    };

    isStatusError(): boolean {
        // Error = 0 means ok, 1 means tracker warn, 2 means tracker error, 3 local error.
        return this.error !== 0;
    };

    isStatusStopped(): boolean {
        return this.status === TransmissionTorrent.STATUS_STOPPED && this.percent !== 1000;
    };

    isStatusQueued(): boolean {
        return this.status === TransmissionTorrent.STATUS_CHECK_WAIT
            || this.status === TransmissionTorrent.STATUS_DOWNLOAD_WAIT
            || this.status === TransmissionTorrent.STATUS_SEED_WAIT;
    };

    isStatusCompleted(): boolean {
        return this.percent === 1000 && this.status === TransmissionTorrent.STATUS_STOPPED && this.error === 0;
    };

    isStatusDownloading(): boolean {
        return this.status === TransmissionTorrent.STATUS_DOWNLOAD || this.isStatusVerifying();
    };

    isStatusSeeding(): boolean {
        return this.status === TransmissionTorrent.STATUS_SEED;
    };

    isStatusPaused(): boolean {
        return ;
    };


    statusText(): string {
        if (this.isStatusVerifying()){
            return 'Verifying';
        } else if (this.isStatusQueuedToVerify()) {
            return 'Queued to Verify';
        } else if (this.isStatusQueued()) {
            return 'Queued';
        } else if (this.isStatusSeeding()){
            return 'Seeding';
        } else if (this.isStatusDownloading()){
            return 'Downloading';
        } else if (this.isStatusError()){
            return 'Error';
        } else if (this.isStatusStopped()){
            return 'Stopped';
        } else if (this.isStatusCompleted()){
            return 'Completed';
        } else if (this.isStatusPaused()){
            return 'Paused';
        }  else {
            return 'Unknown';
        }

    }

}
