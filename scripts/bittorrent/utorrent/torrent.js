'use strict';

angular.module('torrentApp').factory('TorrentU', ['AbstractTorrent', function(AbstractTorrent) {

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
    function Torrent(hash,
        status,
        name,
        size,
        percent,
        downloaded,
        uploaded,
        ratio,
        uploadSpeed,
        downloadSpeed,
        eta,
        label,
        peersConnected,
        peersInSwarm,
        seedsConnected,
        seedsInSwarm,
        availability,
        torrentQueueOrder,
        remaining,
        downloadUrl,
        rssFeedUrl,
        statusMessage,
        streamId,
        dateAdded,
        dateCompleted,
        appUpdateUrl,
        savePath,
        additionalData) {

        AbstractTorrent.call(this, {
            hash: hash,
            status: status,
            name: name,
            size: size,
            percent: percent,
            downloaded: downloaded,
            uploaded: uploaded,
            ratio: (ratio / 1000).toFixed(2),
            uploadSpeed: uploadSpeed,
            downloadSpeed: downloadSpeed,
            eta: eta,
            label: label,
            peersConnected: peersConnected,
            peersInSwarm: peersInSwarm,
            seedsConnected: seedsConnected,
            seedsInSwarm: seedsInSwarm,
            availability: (availability / 65536).toFixed(1),
            torrentQueueOrder: torrentQueueOrder,
            remaining: remaining,
            downloadUrl: downloadUrl,
            rssFeedUrl: rssFeedUrl,
            statusMessage: statusMessage,
            streamId: streamId,
            dateAdded: dateAdded * 1000,
            dateCompleted: dateCompleted * 100,
            appUpdateUrl: appUpdateUrl,
            savePath: savePath,
            additionalData: additionalData}
        );

    }

    // Inherit by prototypal inheritance
    Torrent.prototype = Object.create(AbstractTorrent.prototype);

    var statusesMap = {
        1: 'started',
        2: 'checking',
        4: 'startaftercheck',
        8: 'checked',
        16: 'error',
        32: 'paused',
        64: 'queued',
        128: 'loaded'
    };
    var statusesFlags = [1, 2, 4, 8, 16, 32, 64, 128].reverse();

    Torrent.prototype.getStatusFlag = function(x) {
        /*jshint bitwise: false*/
        return(this.status & x) === x;
        /*jshint bitwise: true*/
    };

    Torrent.prototype.getStatuses = function() {
        //var str = '';
        var i = 0;

        if(this.statusesCached) {
            return this.statusesCached;
        }
        var res = [];

        for(i = 0; i < statusesFlags.length; i++) {
            if(this.getStatusFlag(statusesFlags[i])) {
                res.push(statusesMap[statusesFlags[i]]);
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

    Torrent.prototype.isStatusStarted = function() {
        return this.getStatusFlag(1);
    };
    Torrent.prototype.isStatusChecking = function() {
        return this.getStatusFlag(2);
    };
    Torrent.prototype.isStatusStartAfterCheck = function() {
        return this.getStatusFlag(4);
    };
    Torrent.prototype.isStatusChecked = function() {
        return this.getStatusFlag(8);
    };
    Torrent.prototype.isStatusError = function() {
        return this.getStatusFlag(16);
    };
    Torrent.prototype.isStatusPaused = function() {
        return this.getStatusFlag(32);
    };
    Torrent.prototype.isStatusQueued = function() {
        return this.getStatusFlag(64) && !this.isStatusDownloading();
    };
    Torrent.prototype.isStatusLoaded = function() {
        return this.getStatusFlag(128);
    };
    Torrent.prototype.isStatusCompleted = function() {
        return(this.percent === 1000);
    };
    Torrent.prototype.isStatusDownloading = function() {
        return this.getStatusFlag(64);
    };
    Torrent.prototype.isStatusSeeding = function() {
        return this.isStatusStarted() && (this.isStatusCompleted());
    };
    Torrent.prototype.isStatusStopped = function() {
        return(!this.getStatusFlag(64)) && (!this.isStatusCompleted());
    };

    /**
     * Return the constructor function
     */
    return Torrent;
}]);