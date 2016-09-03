'use strict';

angular.module('torrentApp').factory('TorrentT', ['AbstractTorrent', function(AbstractTorrent) {

    /**
     * Constructor, with class name.
     * Replace all occurences of TorrentT (including underscores) with
     * the name of your torrent class. Best practise is naming the class 'Torrent'
     * and appending a single letter desribing the client to which it belongs.
     * (e.g. TorrentQ for qBittorrent, TorrentU for µTorrent... and so on)
     */
    function TorrentT(data) {
        /*
         * Please modify the constructor function parameters to
         * your liking for the best implementation. If data is obtained as an array from
         * the API one could list each function parameter in the same order as the array
         */

        AbstractTorrent.call(this, {
            hash: data.id, /* Hash (string): unique identifier for the torrent */
            name: data.name, /* Name (string): the name of the torrent */
            size: data.totalSize, /* Size (integer): size of the file to be downloaded in bytes */
            percent: data.percentDone * 1000, /* Percent (integer): completion in per-mille (100% = 1000)  */
            downloaded: data.downloadedEver, /* Downloaded (integer): number of bytes */
            uploaded: data.uploadedEver, /* Uploaded (integer): number of bytes */
            ratio: data.uploadRatio, /* Ratio (integer): integer i per-mille (1:1 = 1000) */
            uploadSpeed: data.rateUpload,  /* Upload Speed (integer): bytes per second */
            downloadSpeed: data.rateDownload, /* Download Speed (integer): bytes per second */
            eta: data.eta, /* ETA (integer): second to completion */
            label: data.comment, /* Label (string): group/category identification */
            peersConnected: data.peersConnected, /* Peers Connected (integer): number of peers connected */
            peersInSwarm: data.maxConnectedPeers, /* Peers In Swarm (integer): number of peers in the swarm */
            seedsConnected: data.peersGettingToUs, /* Seeds Connected (integer): number of connected seeds */
            seedsInSwarm: data.seedsGettingFromUs, /* Seeds In Swarm (integer): number of connected seeds in swarm */
            torrentQueueOrder: data.queuePosition, /* Queue (integer): the number in the download queue */
            statusMessage: '', /* Status (string): the current status of the torrent (e.g. downloading)  */
            dateAdded: data.dateAdded, /* Date Added (integer): number of milliseconds unix time */
            dateCompleted: data.doneDate, /* Date Completed (integer): number of milliseconds unix time */
            savePath: data.downloadDir, /* Save Path (string): the path at which the downloaded content is saved */
        });

        /*
         * Additional data that does not match the default scheme above
         * may be added as extra fields. This can be done in the manner below
         */
        this.status = data.status;

    }

    /*
     * Inherit by prototypal inheritance. Leave this line as is (only rename class name).
     * Do NOT implement any prototypal features above this line!
     */
    TorrentT.prototype = Object.create(AbstractTorrent.prototype);


    /**
     * Returns whether this torrent is in an error state. Torrents in this group shows
     * up in the 'Error' tab in the GUI
     * @return {boolean} isStatusError
     */
    TorrentT.prototype.isStatusError = function() {
        return
    };

    /**
     * Returns whether this torrent is stopped. Torrents in this group shows up in
     * the 'Stopped' tab to the left in the GUI
     * @return {boolean} isStatusStopped
     */
    TorrentT.prototype.isStatusStopped = function() {
        return
    };

    /**
     * Returns whether this torrent is in queue for downloading. Torrents in this group shows up
     * in the same tab as 'Downloading' in the GUI
     * @return {boolean} isStatusQueue
     */
    TorrentT.prototype.isStatusQueued = function() {
        return
    };

    /**
     * Returns whether this torrent is completed. Usually this can be done by
     * checking whether this.percent === 1000 which means 100%. Torrents in this group
     * shows up the 'Finished' tab in the GUI
     * @return {boolean} isStatusCompleted
     */
    TorrentT.prototype.isStatusCompleted = function() {
        return
    };

    /**
     * Returns whether this torrent is downloading. Torrents in this group
     * shows up the 'Downloading' tab in the GUI
     * @return {boolean} isStatusDownloading
     */
    TorrentT.prototype.isStatusDownloading = function() {
        return this.status === 4;
    };

    /**
     * Returns whether this torrent is seeding. Torrents in this group
     * shows up the 'Seeding' tab in the GUI
     * @return {boolean} isStatusDownloading
     */
    TorrentT.prototype.isStatusSeeding = function() {
        return this.status === 6;
    };

    /**
     * Returns whether this torrent is paused. Torrents in this group
     * shows up in the same tab as the 'Downloading' tab in the GUI.
     * @return {boolean} isStatusDownloading
     */
    TorrentT.prototype.isStatusPaused = function() {
        return this.status === 0;
    };

    /**
     * Optionally returns the color for the progress bar used as a class in CSS.
     * Colors are decided by default using the status functions above. Only implement
     * this when having color issues.
     * @return {string} color
     */
    /*TorrentT.prototype.statusColor = function () {};*/

    /**
     * Optionally returns the status of the torrent. The status is by default
     * computed using the.statusMessage. Only implement this when having trouble with
     * incorrect status messages in the GUI
     * @return {string} status
     */
    TorrentT.prototype.statusText = function () {
        switch(this.status) {
            case 4:
                return 'Downloading';
            case 0:
                return 'Paused';
            case 6:
                return 'Uploading'
            default:
                return 'Not Specified'
        }
    }
    /**
     * Return the constructor function (only change the class name)
     */
    return TorrentT;
}]);
