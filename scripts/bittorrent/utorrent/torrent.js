'use strict';

angular.module('torrentApp')
    .factory('Torrent', function($window, $log) {

        var decodeNames = true;
        // if ($cookies.get(ntuConst.decodeNames)) {
        //     decodeNames = $cookies.get(ntuConst.decodeNames) === 'true';
        // } else {
        //     decodeNames = true;
        // }

        var decodeName = function(name) {
            if (decodeNames) {
                return name.replace(/[\._]/g, ' ').replace(/(\[[^\]]*\])(.*)$/, '$2 $1').trim();
            } else {
                return name;
            }
        };

        var cleanName = function(name) {
            return name.toLowerCase().replace(/s?([0-9]{1,2})[x|e|-]([0-9]{1,2})/, '').replace(/(bdrip|brrip|cam|dttrip|dvdrip|dvdscr|dvd|fs|hdtv|hdtvrip|hq|pdtv|satrip|dvbrip|r5|r6|ts|tc|tvrip|vhsrip|vhsscr|ws|aac|ac3|dd|dsp|dts|lc|ld|md|mp3|xvid|720p|1080p|fs|internal|limited|proper|stv|subbed|tma|tnz|silent|tls|gbm|fsh|rev|trl|upz|unrated|webrip|ws|mkv|avi|mov|mp4|mp3|iso|x264|x265|h264|h265)/g, '').trim();
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

            this.selected = false;
            this.isStarred = false;

            this.hash = hash;
            this.status = status;
            this.name = name;
            this.size = size;
            this.percent = percent;
            this.downloaded = downloaded;
            this.uploaded = uploaded;
            this.ratio = (ratio / 1000).toFixed(2);
            this.uploadSpeed = uploadSpeed;
            this.downloadSpeed = downloadSpeed;
            this.eta = eta;
            this.label = label;
            this.peersConnected = peersConnected;
            this.peersInSwarm = peersInSwarm;
            this.seedsConnected = seedsConnected;
            this.seedsInSwarm = seedsInSwarm;
            this.availability = (availability / 65536).toFixed(1);
            this.torrentQueueOrder = torrentQueueOrder;
            this.remaining = remaining;
            this.downloadUrl = downloadUrl;
            this.rssFeedUrl = rssFeedUrl;
            this.statusMessage = statusMessage;
            this.streamId = streamId;
            this.dateAdded = dateAdded * 1000;
            this.dateCompleted = dateCompleted * 1000;
            this.appUpdateUrl = appUpdateUrl;
            this.savePath = savePath;
            this.additionalData = additionalData;

            this.decodedName = decodeName(this.name);
            this.getStatuses();
            this.cleanedName = cleanName(this.decodedName);
        }


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
        

        Torrent.prototype.update = function(other) {
            for (var k in other) {
                if (other.hasOwnProperty(k) && k !== 'selected') {
                    this[k] = other[k];
                }
            }
        };

        Torrent.prototype.getMagnetURI = function(longUri) {
            var i = 0;
            var link = 'magnet:?xt=urn:btih:' + this.hash;
            if (longUri) {
                link += '&dn=' + encodeURIComponent(this.name);
                link += '&xl=' + encodeURIComponent(this.size);

                if (this.props && this.props.trackers) {
                    var trackers = this.props.trackers.split('\r\n');
                    for (i = 0; i < trackers.length; i++) {
                        if (trackers[i].length > 0) {
                            link += '&tr=' + encodeURIComponent(trackers[i]);
                        }
                    }
                }
            }
            return link;
        };

        Torrent.prototype.getStatusFlag = function(x) {
            /*jshint bitwise: false*/
            return (this.status & x) === x;
            /*jshint bitwise: true*/
        };

        Torrent.prototype.getStatuses = function() {
            //var str = '';
            var i = 0;

            if (this.statusesCached) {
                return this.statusesCached;
            }
            var res = [];

            for (i = 0; i < statusesFlags.length; i++) {
                if (this.getStatusFlag(statusesFlags[i])) {
                    res.push(statusesMap[statusesFlags[i]]);
                }
            }
            if (this.status > 255) {
                res.push('unknown');
                $log.warn('unknown status: ' + this.status);
            }

            if (this.percent === 1000) {
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
            return (this.percent === 1000);
        };
        Torrent.prototype.isStatusDownloading = function() {
            return this.getStatusFlag(64);
        };
        Torrent.prototype.isStatusSeeding = function() {
            return this.isStatusStarted() && (this.isStatusCompleted());
        };
        Torrent.prototype.isStatusStopped = function() {
            return (!this.getStatusFlag(64)) && (!this.isStatusCompleted());
        };

        Torrent.prototype.getQueueStr = function() {
            if (this.torrentQueueOrder === -1) {
                return '*';
            }
            return this.torrentQueueOrder;
        };

        Torrent.prototype.getPercentStr = function() {
            return (this.percent / 10).toFixed(0) + '%';
        };

        var formatBytesCache = {};

        function formatBytes(bytes) {
            if (formatBytesCache[bytes]) {
                return formatBytesCache[bytes];
            }
            var val;
            var uom;

            if (bytes < 1024) {
                val = bytes;
                uom = 'B';
            } else if (bytes < 1048576) {
                val = (bytes / 1024).toFixed(1);
                uom = 'KB';
            } else if (bytes < 1073741824) {
                val = (bytes / 1048576).toFixed(1);
                uom = 'MB';
            } else {
                val = (bytes / 1073741824).toFixed(1);
                uom = 'GB';
            }
            return [val, uom];
        }

        Torrent.prototype.formatBytesStrArr = function(bytes) {
            return formatBytes(bytes);
        };

        Torrent.prototype.formatBytes = function(bytes) {
            return formatBytes(bytes).join('');
        };

        Torrent.prototype.getDownloadedStrArr = function() {
            if (!this.downloadedStrArr) {
                this.downloadedStrArr = formatBytes(this.downloaded);
            }
            return this.downloadedStrArr;
        };

        Torrent.prototype.getUploadedStrArr = function() {
            if (!this.uploadedStrArr) {
                this.uploadedStrArr = formatBytes(this.uploaded);
            }
            return this.uploadedStrArr;
        };

        Torrent.prototype.getSizeStrArr = function() {
            if (!this.sizeStrArr) {
                this.sizeStrArr = formatBytes(this.size);
            }
            return this.sizeStrArr;
        };

        Torrent.prototype.getUpSpeedStrArr = function() {
            if (!this.upSpeedStrArr) {
                var res = formatBytes(this.uploadSpeed);
                res[1] = res[1] + '/s';
                this.upSpeedStrArr = res;
            }
            return this.upSpeedStrArr;
        };

        Torrent.prototype.getDownSpeedStrArr = function() {
            if (!this.downSpeedStrArr) {
                var res = formatBytes(this.downloadSpeed);
                res[1] = res[1] + '/s';
                this.downSpeedStrArr = res;
            }
            return this.downSpeedStrArr;
        };

        Torrent.prototype.getLabels = function() {
            if (typeof this.label === 'string') {
                return [this.label];
            } else {
                return this.label;
            }
        };

        Torrent.prototype.getMainLabel = function() {
            var labels = this.getLabels();
            if (labels && labels.length > 0) {
                return labels[0];
            } else {
                return '';
            }
        };

        Torrent.cache = {};

        /**
         * Return the constructor function
         */
        return Torrent;
    });
