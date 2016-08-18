'use strict';

angular.module('torrentApp').factory('TorrentQ', ['AbstractTorrent', function(AbstractTorrent) {

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
    function Torrent(hash, data) {

        AbstractTorrent.call(this, {
            hash: hash,
            status: undefined,
            name: data.name,
            size: data.size || data.total_size,
            percent: data.progress * 1000,
            downloaded: data.total_downloaded,
            uploaded: data.total_uploaded,
            ratio: data.share_ration || data.ratio,
            uploadSpeed: data.up_speed || data.upspeed,
            downloadSpeed: data.dl_speed || data.dlspeed,
            eta: data.eta,
            label: data.category,
            peersConnected: data.nb_connections,
            peersInSwarm: data.peers_total,
            seedsConnected: data.seeds,
            seedsInSwarm: data.seeds_total || data.num_complete,
            availability: undefined,
            torrentQueueOrder: data.priority,
            remaining: undefined,
            downloadUrl: undefined,
            rssFeedUrl: undefined,
            statusMessage: data.state,
            streamId: undefined,
            dateAdded: data.addition_date || data.added_on,
            dateCompleted: data.completion_date || data.completion_on,
            appUpdateUrl: undefined,
            savePath: data.savePath,
            additionalData: undefined
        });

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
        this.leechersInSwarm = data.num_incomplete;
        this.leechersConnected = data.num_leechs;
        this.sequentialDownload = data.seq_dl;

    }

    // Inherit by prototypal inheritance
    Torrent.prototype = Object.create(AbstractTorrent.prototype);

    Torrent.prototype.getStatus = function() {
        var args = Array.prototype.slice.call(arguments);
        return (args.indexOf(this.statusMessage) > -1);
    }


    Torrent.prototype.isStatusStarted = function() {
        return
    };
    Torrent.prototype.isStatusChecking = function() {
        return
    };
    Torrent.prototype.isStatusStartAfterCheck = function() {
        return
    };
    Torrent.prototype.isStatusChecked = function() {
        return
    };
    Torrent.prototype.isStatusError = function() {
        return this.getStatus('error')
    };
    Torrent.prototype.isStatusPaused = function() {
        return this.getStatus('paused', 'pausedUP', 'pausedDL');
    };
    Torrent.prototype.isStatusQueued = function() {
        return this.getStatus('queuedUP', 'queuedDL');
    };
    Torrent.prototype.isStatusLoaded = function() {
        return false;
    };
    Torrent.prototype.isStatusCompleted = function() {
        return(this.percent === 1000);
    };
    Torrent.prototype.isStatusDownloading = function() {
        return this.getStatus('downloading')
    };
    Torrent.prototype.isStatusSeeding = function() {
        return this.getStatus('uploading')
    };
    Torrent.prototype.isStatusStopped = function() {
        return false;
    };

    /**
     * Return the constructor function
     */
    return Torrent;
}]);