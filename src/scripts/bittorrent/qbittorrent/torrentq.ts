import { Torrent } from '../abstracttorrent';

export class QBittorrentTorrent extends Torrent {

    // Field specific for qBittorrent
    state: string
    creationDate: string
    pieceSize: number
    comment: string
    totalWasted: number
    uploadedSession: number
    downloadedSession: number
    upLimit: number
    downLimit: number
    timeElapsed: number
    seedingTime: number
    connectionsLimit: number
    createdBy: number
    downAvgSpeed: number
    lastSeen: number
    peers: number
    havePieces: any
    totalPieces: number
    reannounce: string
    upSpeedAvg: number
    forceStart: boolean
    sequentialDownload: boolean


    constructor(hash: string, data: Record<string, any>) {
        super({
            hash: hash,
            name: data.name,
            size: data.size || data.total_size,
            percent: data.progress && (data.progress * 1000),
            downloaded: data.total_downloaded,
            uploaded: data.total_uploaded,
            ratio: data.share_ration || data.ratio,
            uploadSpeed: data.up_speed || data.upspeed,
            downloadSpeed: data.dl_speed || data.dlspeed,
            eta: data.eta,
            label: data.category || data.label,
            peersConnected: data.num_leechs,
            peersInSwarm: data.num_incomplete,
            seedsConnected: data.num_seeds,
            seedsInSwarm: data.num_complete,
            torrentQueueOrder: data.priority,
            statusMessage: undefined, // Not supplied
            dateAdded: (data.addition_date || data.added_on) * 1000 || undefined,
            dateCompleted: (data.completion_date || data.completion_on) * 1000 || undefined,
            savePath: data.save_path,
        });

        this.state = data.state
        this.creationDate = data.creation_date;
        this.pieceSize = data.piece_size;
        this.comment = data.comment;
        this.totalWasted = data.total_wasted;
        this.uploadedSession = data.total_uploaded_session;
        this.downloadedSession = data.total_downloaded_session;
        this.upLimit = data.up_limit;
        this.downLimit = data.dl_limit;
        this.timeElapsed = data.time_elapsed;
        this.seedingTime = data.seeding_time;
        this.connectionsLimit = data.nb_connections_limit;
        this.createdBy = data.created_by;
        this.downAvgSpeed = data.dl_speed_avg;
        this.lastSeen = data.last_seen;
        this.peers = data.peers;
        this.havePieces = data.pieces_have;
        this.totalPieces = data.pieces_num;
        this.reannounce = data.reannounce;
        this.upSpeedAvg = data.up_speed_avg;
        this.forceStart = data.force_start;
        this.sequentialDownload = data.seq_dl;
    }

    getStatus(...statusOr: string[]) {
        return statusOr.includes(this.state);
    }

    isStatusError() {
        return this.getStatus('error', 'missingFiles');
    };
    isStatusStopped() {
        return this.getStatus('paused', 'pausedUP', 'pausedDL', 'stopped', 'stoppedUP', 'stoppedDL') && !this.isStatusCompleted();
    };
    isStatusQueued() {
        return this.getStatus('queuedUP', 'queuedDL', 'allocating');
    };
    isStatusCompleted() {
        return (this.percent === 1000) || this.getStatus('checkingUP', 'moving');
    };
    isStatusDownloading() {
        return this.getStatus('downloading', 'stalledDL', 'metaDL', 'forcedDL') || this.isStatusChecking();
    };
    isStatusSeeding() {
        return this.getStatus('uploading', 'stalledUP', 'forcedUP');
    };
    isStatusPaused() {
        /* qBittorrent only has started and stopped torrents */
        return false;
    };

    /* Additional custom states */
    isStatusChecking() {
        return this.getStatus('checkingDL', 'checkingUP', 'checkingResumeData');
    }

    manualStatusText() {
        if (this.isStatusChecking()) {
            return 'Checking';
        } else {
            return super.manualStatusText();
        }
    };

}
