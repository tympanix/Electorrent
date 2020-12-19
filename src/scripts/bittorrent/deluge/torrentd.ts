
export let TorrentD = ['AbstractTorrent', function(AbstractTorrent) {

    /**
     * Constructor, with class name.
     * Replace all occurences of TorrentD (including underscores) with
     * the name of your torrent class. Best practise is naming the class 'Torrent'
     * and appending a single letter desribing the client to which it belongs.
     * (e.g. TorrentQ for qBittorrent, TorrentU for µTorrent... and so on)
     */
    function TorrentD(hash, data) {
        /*
         * Please modify the constructor function parameters to
         * your liking for the best implementation. If data is obtained as an array from
         * the API one could list each function parameter in the same order as the array
         */

        AbstractTorrent.call(this, {
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

    /*
     * Inherit by prototypal inheritance. Leave this line as is (only rename class name).
     * Do NOT implement any prototypal features above this line!
     */
    TorrentD.prototype = Object.create(AbstractTorrent.prototype);


    /**
     * Returns whether this torrent is in an error state. Torrents in this group shows
     * up in the 'Error' tab in the GUI
     * @return {boolean} isStatusError
     */
    TorrentD.prototype.isStatusError = function() {
        return this.state === "Error"
    };

    /**
     * Returns whether this torrent is stopped. Torrents in this group shows up in
     * the 'Stopped' tab to the left in the GUI
     * @return {boolean} isStatusStopped
     */
    TorrentD.prototype.isStatusStopped = function() {
        return this.state === "Paused"
    };

    /**
     * Returns whether this torrent is in queue for downloading. Torrents in this group shows up
     * in the same tab as 'Downloading' in the GUI
     * @return {boolean} isStatusQueue
     */
    TorrentD.prototype.isStatusQueued = function() {
        return this.state === "Queued"
    };

    /**
     * Returns whether this torrent is completed. Usually this can be done by
     * checking whether this.percent === 1000 which means 100%. Torrents in this group
     * shows up the 'Finished' tab in the GUI
     * @return {boolean} isStatusCompleted
     */
    TorrentD.prototype.isStatusCompleted = function() {
        return this.percent === 1000
    };

    /**
     * Returns whether this torrent is downloading. Torrents in this group
     * shows up the 'Downloading' tab in the GUI
     * @return {boolean} isStatusDownloading
     */
    TorrentD.prototype.isStatusDownloading = function() {
        return this.state === "Downloading"
    };

    /**
     * Returns whether this torrent is seeding. Torrents in this group
     * shows up the 'Seeding' tab in the GUI
     * @return {boolean} isStatusDownloading
     */
    TorrentD.prototype.isStatusSeeding = function() {
        return this.state === "Seeding"
    };

    /**
     * Returns whether this torrent is paused. Torrents in this group
     * shows up in the same tab as the 'Downloading' tab in the GUI.
     * @return {boolean} isStatusDownloading
     */
    TorrentD.prototype.isStatusPaused = function() {
        return false
    };

    /**
     * Optionally returns the color for the progress bar used as a class in CSS.
     * Colors are decided by default using the status functions above. Only implement
     * this when having color issues.
     * @return {string} color
     */
    /*TorrentD.prototype.statusColor = function () {};*/

    /**
     * Optionally returns the status of the torrent. The status is by default
     * computed using the.statusMessage. Only implement this when having trouble with
     * incorrect status messages in the GUI
     * @return {string} status
     */
    /*TorrentD.prototype.statusText = function () { };*/

    /**
     * Return the constructor function (only change the class name)
     */
    return TorrentD;
}];