'use strict';

angular.module('torrentApp').factory('AbstractTorrent', function() {

    const statusRegex = /[^a-zA-Z(): ]/g;

    var decodeName = function(name) {
        if(!name) return undefined

        return name.replace(/[\._]/g, ' ').replace(/(\[[^\]]*\])(.*)$/, '$2 $1').trim();
    };

    var cleanName = function(name) {
        if(!name) return undefined

        return name.toLowerCase().replace(/s?([0-9]{1,2})[x|e|-]([0-9]{1,2})/, '').replace(
            /(bdrip|brrip|cam|dttrip|dvdrip|dvdscr|dvd|fs|hdtv|hdtvrip|hq|pdtv|satrip|dvbrip|r5|r6|ts|tc|tvrip|vhsrip|vhsscr|ws|aac|ac3|dd|dsp|dts|lc|ld|md|mp3|xvid|720p|1080p|fs|internal|limited|proper|stv|subbed|tma|tnz|silent|tls|gbm|fsh|rev|trl|upz|unrated|webrip|ws|mkv|avi|mov|mp4|mp3|iso|x264|x265|h264|h265)/g,
            '').trim();
    };

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
    function AbstractTorrent({
        hash,
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
        torrentQueueOrder,
        statusMessage,
        dateAdded,
        dateCompleted,
        savePath
    }) {

        this.selected = false;
        this.isStarred = false;

        this.hash = hash;
        this.name = name;
        this.size = size;
        this.percent = percent;
        this.downloaded = downloaded;
        this.uploaded = uploaded;
        this.ratio = ratio;
        this.uploadSpeed = uploadSpeed;
        this.downloadSpeed = downloadSpeed;
        this.eta = eta;
        this.label = label;
        this.peersConnected = peersConnected;
        this.peersInSwarm = peersInSwarm;
        this.seedsConnected = seedsConnected;
        this.seedsInSwarm = seedsInSwarm;
        this.torrentQueueOrder = torrentQueueOrder;
        this.statusMessage = statusMessage;
        this.dateAdded = dateAdded;
        this.dateCompleted = dateCompleted;
        this.savePath = savePath;

        this.decodedName = decodeName(this.name);
        this.cleanedName = cleanName(this.decodedName);
    }

    AbstractTorrent.prototype.update = function(other) {
        for(var k in other) {
            if(other.hasOwnProperty(k) && k !== 'selected') {
                if(other[k] !== undefined) {
                    this[k] = other[k];
                }
            }
        }
    };

    AbstractTorrent.prototype.getMagnetURI = function(longUri) {
        var i = 0;
        var link = 'magnet:?xt=urn:btih:' + this.hash;
        if(longUri) {
            link += '&dn=' + encodeURIComponent(this.name);
            link += '&xl=' + encodeURIComponent(this.size);

            if(this.props && this.props.trackers) {
                var trackers = this.props.trackers.split('\r\n');
                for(i = 0; i < trackers.length; i++) {
                    if(trackers[i].length > 0) {
                        link += '&tr=' + encodeURIComponent(trackers[i]);
                    }
                }
            }
        }
        return link;
    };


    AbstractTorrent.prototype.isStatusError = function() {
        throw new Error('isStatusError not implemented');
    };
    AbstractTorrent.prototype.isStatusPaused = function() {
        throw new Error('isStatusPaused not implemented');
    };
    AbstractTorrent.prototype.isStatusQueued = function() {
        throw new Error('isStatusQueued not implemented');
    };
    AbstractTorrent.prototype.isStatusCompleted = function() {
        throw new Error('isStatusCompleted not implemented');
    };
    AbstractTorrent.prototype.isStatusDownloading = function() {
        throw new Error('isStatusDownloading not implemented');
    };
    AbstractTorrent.prototype.isStatusSeeding = function() {
        throw new Error('isStatusSeeding not implemented');
    };
    AbstractTorrent.prototype.isStatusStopped = function() {
        throw new Error('isStatusStopped not implemented');
    };

    AbstractTorrent.prototype.getQueueStr = function() {
        if(this.torrentQueueOrder === -1) {
            return '*';
        }
        return this.torrentQueueOrder;
    };

    AbstractTorrent.prototype.getPercentStr = function() {
        return(this.percent / 10).toFixed(0) + '%';
    };

    AbstractTorrent.prototype.statusColor = function () {
        if (this.isStatusPaused()){
            return 'grey';
        } else if (this.isStatusSeeding()){
            return 'orange';
        } else if (this.isStatusDownloading()){
            return 'blue';
        } else if (this.isStatusError()){
            return 'error';
        } else if (this.isStatusCompleted()){
            return 'success';
        } else {
            return 'disabled';
        }
    };

    AbstractTorrent.prototype.statusText = function () {
        return this.statusMessage.replace(statusRegex, '');
    };

    AbstractTorrent.sort = function(attribute) {
        switch (attribute) {
            case 'decodedName': return alphabetical
            case 'label': return alphabetical
            default: return numerical
        }
    }

    function alphabetical(a, b) {
        var aLower = a.toLowerCase();
        var bLower = b.toLowerCase();
        return aLower.localeCompare(bLower);
    }

    function numerical(a, b){
        return b - a;
    }

    /**
     * Return the constructor function
     */
    return AbstractTorrent;
});