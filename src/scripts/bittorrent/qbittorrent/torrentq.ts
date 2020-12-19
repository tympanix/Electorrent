
export let torrentQ = ['AbstractTorrent', function(AbstractTorrent) {

    /**
    hash (string),
    status* (integer),
    name (string),
    size (integer in bytes),
    percent progress (integer in per mils),
    downloaded (integer in bytes),
    upload-speeded (integer in bytes),
    ratio (integer in per mils),
    upload-speed speed (integer in bytes per second),
    download speed (integer in bytes per second),
    eta (integer in seconds),
    label (string),
    peers connected (integer),
    peers in swarm (integer),
    seeds connected (integer),
    seeds in swarm (integer),
    availability (integer in 1/65535ths),
    torrent queue order (integer),
    remaining (integer in bytes)
    */

    /**
     * Constructor, with class name
     */
    function TorrentQ(hash, data) {

        AbstractTorrent.call(this, {
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

    // Inherit by prototypal inheritance
    TorrentQ.prototype = Object.create(AbstractTorrent.prototype);

    TorrentQ.prototype.getStatus = function() {
        var args = Array.prototype.slice.call(arguments);
        return (args.indexOf(this.state) > -1);
    }

    TorrentQ.prototype.isStatusError = function() {
        return this.getStatus('error')
    };
    TorrentQ.prototype.isStatusStopped = function() {
        return this.getStatus('paused', 'pausedUP', 'pausedDL') && !this.isStatusCompleted()
    };
    TorrentQ.prototype.isStatusQueued = function() {
        return this.getStatus('queuedUP', 'queuedDL')
    };
    TorrentQ.prototype.isStatusCompleted = function() {
        return (this.percent === 1000) || this.getStatus('checkingUP')
    };
    TorrentQ.prototype.isStatusDownloading = function() {
        return this.getStatus('downloading', 'stalledDL', 'metaDL') || this.isStatusChecking()
    };
    TorrentQ.prototype.isStatusSeeding = function() {
        return this.getStatus('uploading', 'stalledUP')
    };
    TorrentQ.prototype.isStatusPaused = function() {
        /* qBittorrent only has started and stopped torrents */
        return false
    };

    /* Additional custom states */
    TorrentQ.prototype.isStatusChecking = function() {
        return this.getStatus('checkingDL', 'checkingUP', 'checkingResumeData')
    }

    TorrentQ.prototype.manualStatusText = function () {
        if (this.isStatusChecking()) {
            return 'Checking'
        } else {
            return AbstractTorrent.prototype.manualStatusText.call(this)
        }
    };

    /**
     * Return the constructor function
     */
    return TorrentQ;
}];