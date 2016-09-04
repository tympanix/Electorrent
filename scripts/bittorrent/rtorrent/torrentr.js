'use strict';

angular.module('torrentApp').factory('TorrentR', ['AbstractTorrent', 'rtorrentConfig', function(AbstractTorrent, rtorrentConfig) {

    /**
     * Constructor, with class name.
     * Replace all occurences of __TorrentName__ (including underscores) with
     * the name of your torrent class. Best practise is naming the class 'Torrent'
     * and appending a single letter desribing the client to which it belongs.
     * (e.g. TorrentQ for qBittorrent, TorrentU for µTorrent... and so on)
     */
    function TorrentR(array) {
        /*
         * Please modify the constructor function parameters to
         * your liking for the best implementation. If data is obtained as an array from
         * the API one could list each function parameter in the same order as the array
         */

        var data = buildData(array);

        AbstractTorrent.call(this, {
            hash: data.get_hash, /* Hash (string): unique identifier for the torrent */
            name: data.get_name, /* Name (string): the name of the torrent */
            size: data.get_size_bytes, /* Size (integer): size of the file to be downloaded in bytes */
            downloaded: data.get_bytes_done, /* Downloaded (integer): number of bytes */
            percent: data.get_bytes_done / data.get_size_bytes * 1000, /* Percent (integer): completion in per-mille (100% = 1000)  */
            uploaded: data.get_up_total, /* Uploaded (integer): number of bytes */
            ratio: data.get_ratio, /* Ratio (integer): integer i per-mille (1:1 = 1000) */
            uploadSpeed: data.get_up_rate,  /* Upload Speed (integer): bytes per second */
            downloadSpeed: data.get_down_rate, /* Download Speed (integer): bytes per second */
            eta: undefined, /* ETA (integer): second to completion MISSING */
            label: data.get_custom1, /* Label (string): group/category identification MISSING */
            peersConnected: data.get_peers_complete, /* Peers Connected (integer): number of peers connected */
            peersInSwarm: data.get_peers_connected, /* Peers In Swarm (integer): number of peers in the swarm */
            seedsConnected: data.get, /* Seeds Connected (integer): number of connected seeds */
            seedsInSwarm: undefined, /* Seeds In Swarm (integer): number of connected seeds in swarm */
            torrentQueueOrder: undefined, /* Queue (integer): the number in the download queue */
            statusMessage: undefined, /* Status (string): the current status of the torrent (e.g. downloading)  */
            dateAdded: undefined, /* Date Added (integer): number of milliseconds unix time */
            dateCompleted: undefined, /* Date Completed (integer): number of milliseconds unix time */
            savePath: data.get_directory, /* Save Path (string): the path at which the downloaded content is saved */
        });

        /*
         * Additional data that does not match the default scheme above
         * may be added as extra fields. This can be done in the manner below
         */
        this.data = data;

        this.status = data.get_state
        this.active = data.is_active
        this.checked = data.is_hash_checked
        this.checking = data.is_hash_checking
        this.open = data.is_open

    }

    function buildData(array) {
        var data = {};
        array.forEach(function(item, index) {
            var key = rtorrentConfig[index];
            data[key] = item
        })
        return data;
    }

    /*
     * Inherit by prototypal inheritance. Leave this line as is (only rename class name).
     * Do NOT implement any prototypal features above this line!
     */
    TorrentR.prototype = Object.create(AbstractTorrent.prototype);


    /**
     * Returns whether this torrent is in an error state. Torrents in this group shows
     * up in the 'Error' tab in the GUI
     * @return {boolean} isStatusError
     */
    TorrentR.prototype.isStatusError = function() {
        return
    };

    /**
     * Returns whether this torrent is stopped. Torrents in this group shows up in
     * the 'Stopped' tab to the left in the GUI
     * @return {boolean} isStatusStopped
     */
    TorrentR.prototype.isStatusStopped = function() {
        return (
            !this.active &&
            !this.open &&
            !this.checking &&
            !this.checked
        );
    };

    /**
     * Returns whether this torrent is in queue for downloading. Torrents in this group shows up
     * in the same tab as 'Downloading' in the GUI
     * @return {boolean} isStatusQueue
     */
    TorrentR.prototype.isStatusQueued = function() {
        return
    };

    /**
     * Returns whether this torrent is completed. Usually this can be done by
     * checking whether this.percent === 1000 which means 100%. Torrents in this group
     * shows up the 'Finished' tab in the GUI
     * @return {boolean} isStatusCompleted
     */
    TorrentR.prototype.isStatusCompleted = function() {
        return (
            !this.state &&
            !this.active &&
            !this.open &&
            this.percent >= 1000
        )
    };

    /**
     * Returns whether this torrent is downloading. Torrents in this group
     * shows up the 'Downloading' tab in the GUI
     * @return {boolean} isStatusDownloading
     */
    TorrentR.prototype.isStatusDownloading = function() {
        return (
            this.open &&
            this.active &&
            this.checked
        )
    };

    /**
     * Returns whether this torrent is seeding. Torrents in this group
     * shows up the 'Seeding' tab in the GUI
     * @return {boolean} isStatusDownloading
     */
    TorrentR.prototype.isStatusSeeding = function() {
        return (
            this.active &&
            this.open &&
            this.state
        )
    };

    /**
     * Returns whether this torrent is paused. Torrents in this group
     * shows up in the same tab as the 'Downloading' tab in the GUI.
     * @return {boolean} isStatusDownloading
     */
    TorrentR.prototype.isStatusPaused = function() {
        return (
            this.open &&
            !this.active &&
            !this.state
        )
    };

    /**
     * Optionally returns the color for the progress bar used as a class in CSS.
     * Colors are decided by default using the status functions above. Only implement
     * this when having color issues.
     * @return {string} color
     */
    /*TorrentR.prototype.statusColor = function () {};*/

    /**
     * Optionally returns the status of the torrent. The status is by default
     * computed using the.statusMessage. Only implement this when having trouble with
     * incorrect status messages in the GUI
     * @return {string} status
     */
    TorrentR.prototype.statusText = function () {
        if (this.isStatusSeeding()){
            return 'Seeding';
        } else if (this.isStatusDownloading()){
            return 'Downloading';
        } else if (this.isStatusError()){
            return 'Error';
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

    /**
     * Return the constructor function (only change the class name)
     */
    return TorrentR;
}]);