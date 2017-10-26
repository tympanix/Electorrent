'use strict';

angular.module('torrentApp').factory('__TorrentName__', ['AbstractTorrent', function(AbstractTorrent) {

    /**
     * Constructor, with class name.
     * Replace all occurences of __TorrentName__ (including underscores) with
     * the name of your torrent class. Best practise is naming the class 'Torrent'
     * and appending a single letter desribing the client to which it belongs.
     * (e.g. TorrentQ for qBittorrent, TorrentU for µTorrent... and so on)
     */
    function __TorrentName__(data) {
        /*
         * Please modify the constructor function parameters to
         * your liking for the best implementation. If data is obtained as an array from
         * the API one could list each function parameter in the same order as the array
         */

        AbstractTorrent.call(this, {
            hash: undefined, /* Hash (string): unique identifier for the torrent */
            name: undefined, /* Name (string): the name of the torrent */
            size: undefined, /* Size (integer): size of the file to be downloaded in bytes */
            percent: undefined, /* Percent (integer): completion in per-mille (100% = 1000)  */
            downloaded: undefined, /* Downloaded (integer): number of bytes */
            uploaded: undefined, /* Uploaded (integer): number of bytes */
            ratio: undefined, /* Ratio (integer): integer i per-mille (1:1 = 1000) */
            uploadSpeed: undefined,  /* Upload Speed (integer): bytes per second */
            downloadSpeed: undefined, /* Download Speed (integer): bytes per second */
            eta: undefined, /* ETA (integer): second to completion */
            label: undefined, /* Label (string): group/category identification */
            peersConnected: undefined, /* Peers Connected (integer): number of peers connected */
            peersInSwarm: undefined, /* Peers In Swarm (integer): number of peers in the swarm */
            seedsConnected: undefined, /* Seeds Connected (integer): number of connected seeds */
            seedsInSwarm: undefined, /* Seeds In Swarm (integer): number of connected seeds in swarm */
            torrentQueueOrder: undefined, /* Queue (integer): the number in the download queue */
            statusMessage: undefined, /* Status (string): the current status of the torrent (e.g. downloading)  */
            dateAdded: undefined, /* Date Added (integer): number of milliseconds unix time */
            dateCompleted: undefined, /* Date Completed (integer): number of milliseconds unix time */
            savePath: undefined, /* Save Path (string): the path at which the downloaded content is saved */
        });

        /*
         * Additional data that does not match the default scheme above
         * may be added as extra fields. This can be done in the manner below
         */
        this.myAddtionalData = undefined;

    }

    /*
     * Inherit by prototypal inheritance. Leave this line as is (only rename class name).
     * Do NOT implement any prototypal features above this line!
     */
    __TorrentName__.prototype = Object.create(AbstractTorrent.prototype);


    /**
     * Returns whether this torrent is in an error state. Torrents in this group shows
     * up in the 'Error' tab in the GUI
     * @return {boolean} isStatusError
     */
    __TorrentName__.prototype.isStatusError = function() {
        return
    };

    /**
     * Returns whether this torrent is stopped. Torrents in this group shows up in
     * the 'Stopped' tab to the left in the GUI
     * @return {boolean} isStatusStopped
     */
    __TorrentName__.prototype.isStatusStopped = function() {
        return
    };

    /**
     * Returns whether this torrent is in queue for downloading. Torrents in this group shows up
     * in the same tab as 'Downloading' in the GUI
     * @return {boolean} isStatusQueue
     */
    __TorrentName__.prototype.isStatusQueued = function() {
        return
    };

    /**
     * Returns whether this torrent is completed. Usually this can be done by
     * checking whether this.percent === 1000 which means 100%. Torrents in this group
     * shows up the 'Finished' tab in the GUI
     * @return {boolean} isStatusCompleted
     */
    __TorrentName__.prototype.isStatusCompleted = function() {
        return
    };

    /**
     * Returns whether this torrent is downloading. Torrents in this group
     * shows up the 'Downloading' tab in the GUI
     * @return {boolean} isStatusDownloading
     */
    __TorrentName__.prototype.isStatusDownloading = function() {
        return
    };

    /**
     * Returns whether this torrent is seeding. Torrents in this group
     * shows up the 'Seeding' tab in the GUI
     * @return {boolean} isStatusDownloading
     */
    __TorrentName__.prototype.isStatusSeeding = function() {
        return
    };

    /**
     * Returns whether this torrent is paused. Torrents in this group
     * shows up in the same tab as the 'Downloading' tab in the GUI.
     * @return {boolean} isStatusDownloading
     */
    __TorrentName__.prototype.isStatusPaused = function() {
        return
    };

    /**
     * Optionally returns the color for the progress bar used as a class in CSS.
     * Colors are decided by default using the status functions above. Only implement
     * this when having color issues.
     * @return {string} color
     */
    /*__TorrentName__.prototype.statusColor = function () {};*/

    /**
     * Optionally returns the status of the torrent. The status is by default
     * computed using the.statusMessage. Only implement this when having trouble with
     * incorrect status messages in the GUI
     * @return {string} status
     */
    /*__TorrentName__.prototype.statusText = function () { };*/

    /**
     * Return the constructor function (only change the class name)
     */
    return __TorrentName__;
}]);