'use strict';

angular.module('torrentApp').service('rtorrentService', ["$http", "$q", "xmlrpc", "TorrentR", "rtorrentConfig", "notificationService", function($http, $q, $xmlrpc, TorrentR, rtorrentConfig, $notify) {

    const URL_REGEX = /^(https?)\:\/\/((?:(?:[^:\/?#]+)+\.)?([^\.:\/?#]+\.([a-z]+)))(?:\:([0-9]+))?([\/]{0,1}[^?#]*)(\?[^#]*|)(#.*|)$/

    /*
     * Please rename all occurences of __serviceName__ (including underscores) with the name of your service.
     * Best practise is naming your service starting with the client name in lower case followed by 'Service'
     * (remember capital 'S' e.g qbittorrentService for qBittorrent, utorrentService for µTorrent ect.).
     * The real name of your client for display purposes can be changes in the field 'this.name' below.
     */
    this.name = 'rTorrent';

    /*
     * Good practise is keeping a configuration object for your communication with the API
     */
    const config = {
        version: undefined,
        ip: '',
        port: ''
    }

    const fields = rtorrentConfig.fields.map(fieldTransform);
    const custom = rtorrentConfig.custom.map(customTransform);
    const trackerfields = rtorrentConfig.trackers.map(trackerTransform);

    function url() {
        var ip, port, path;
        if (arguments.length === 1){
            ip = config.ip;
            port = config.port;
            path = arguments[0] || '';
        } else {
            ip = arguments[0]
            port = arguments[1]
            path = arguments[2] || '';
        }
        return `http://${ip}:${port}${path}`;
    }

    function saveConnection(ip, port) {
        config.ip = ip;
        config.port = port;
    }

    function fieldTransform(field) {
        return 'd.' + field + '=';
    }

    function trackerTransform(field) {
        return 't.' + field + '='
    }

    function customTransform(custom) {
        return 'd.get_custom=' + custom;
    }


    /**
     * Connect to the server upon initial startup, changing connection settings ect. The function
     * should return a promise that the connection was successfull. A standard http timeout of 5 seconds
     * must be implemented. When successfull the service should save login details for later use.
     * @param {string} ip
     * @param {integer} port
     * @param {string} user
     * @param {string} password
     * @return {promise} connection
     */
    this.connect = function(ip, port, user, pass) {

        $xmlrpc.config({
            hostName: url(ip, port),
            pathName: "/RPC2"
        })

        var encoded = new Buffer(`${user}:${pass}`).toString('base64');
        $http.defaults.headers.common.Authorization = 'Basic ' + encoded;

        return $xmlrpc.callMethod('system.client_version')
            .then(function(data) {
                config.version = data;
                return $q.resolve('Sucessfully connected to rTorrent');
            }).catch(function(err) {
                console.error(err, err);
                return $q.reject(err);
            })
    }

    /**
     * Return any new information about torrents to be rendered in the GUI. Should return a
     * promise with the required information to be updated. Will be executed by controllers
     * very frequently. You can find a template of the data to be returned in the function.
     * Here you will need:
     *      labels {array}: array of string of each label
     *      all {array}: array of objects inherited from 'AbstractTorrent' that are not currently known.
     *              This means they have just been added or never seen before since the last startup.
     *      changed {array}: array of objects inherited from 'AbstractTorrent' that have allready been seend before.
     *              This means they may contain partial information in which case they ar merged with any present infomation.
     *      deleted {array}: array of string containg the hashes of which torrents to be removed from the list in the GUI.
     * @return {promise} data
     */
    this.torrents = function() {
        let torrents = null
        return $xmlrpc.callMethod('d.multicall', ['main', ...fields, ...custom])
            .then(function(data) {
                torrents = processData(data)
                return $q.resolve(torrents);
            }).then(function(torrents) {
                return getTrackers(torrents.all)
            }).then(function(trackers) {
                torrents.trackers = trackers
                return $q.resolve(torrents)
            }).catch(function(err) {
                console.error("Torrent error", err);
                return $q.reject(err);
            })

    }

    function processData(data) {
        var torrents = {
            dirty: true,
            labels: [],
            all: [],
            changed: [],
            deleted: []
        };

        torrents.all = data.map(build);
        torrents.labels = torrents.all.reduce(fetchLabels, []).map(decodeURIComponent)

        return torrents
    }

    function getTrackers(torrents) {
        if (!torrents.length) return
        let calls = []
        torrents.forEach((torrent) => {
            calls.push({'methodName': 't.multicall', 'params': [torrent.hash, '', ...trackerfields]})
        })
        return $xmlrpc.callMethod('system.multicall', [calls])
            .then(function(data) {
                let trackers = processTrackerData(torrents, data)
                return $q.resolve(trackers)
            })
    }

    function processTrackerData(torrents, data) {
        let trackers = new Set()

        torrents.forEach((torrent, index) => {
            let trackerArray = _.map(data[index][0], function(trackerData) {
                return _.object(rtorrentConfig.trackers, trackerData)
            })
            torrent.addTrackerData(trackerArray)
            _.every(_.pluck(trackerArray, 'get_url'), function(trackerUrl) {
                trackers.add(trackerUrl)
            })
        })
        return Array.from(trackers).map((tracker) => {
            return parseUrl(tracker).hostname
        })
    }

    function parseUrl(url) {
        var match = url.match(URL_REGEX)
        return match && {
            protocol: match[1],
            domain: match[2],
            hostname: match[3],
            extension: match[4],
            port: match[5],
            path: match[6],
            params: match[7],
            hash: match[8]
        }
    }

    function build(array) {
        return new TorrentR(array);
    }

    function fetchLabels(prev, current) {
        if (current.label) prev.push(current.label)
        return prev
    }

    /**
     * Add a torrent to the client by sending a magnet link to the API. Should return
     * a promise that the torrent has been added successfully to the client.
     * @param {string} magnetURL
     * @return {promise} isAdded
     */
    this.addTorrentUrl = function(magnet) {

        $xmlrpc.callMethod('load_start', [magnet])
        .then(function(data) {
            return $q.resolve(data);
        }).catch(function(err) {
            return $q.reject(err);
        });
    }

    /**
     * Add a torrent file with the .torrent extension to the client through the API. Should
     * return a promise that the torrent was added sucessfully. File data is given as a blob
     * more information here: https://developer.mozilla.org/en/docs/Web/API/Blob. You may use
     * the existing implementation as a helping hand
     * @param {blob} filedata
     * @param {string} filename
     * @return {promise} isAdded
     */
    this.uploadTorrent = function(buffer, filename) {
        return $xmlrpc.callMethod('load_raw_start', [buffer])
    }

    function doAction(action, torrents, param) {

        var hashes = torrents.map(function(torrent) {
            return torrent.hash
        })

        var calls = []

        hashes.forEach(function(hash) {
            var call = {
                'methodName': action,
                'params': [hash]
            }

            if (param !== undefined) call.params.push(param)

            calls.push(call)
        })

        return $xmlrpc.callMethod('system.multicall', [calls])
            .then(function(data) {
                return $q.resolve(data);
            }).catch(function(err) {
                console.error("Action error", err);
                return $q.reject(err);
            })

    }

    /**
     * Example action function. You will have to implement several of these to support the various
     * actions in your bittorrent client. Each action is supplied an array of the hashes on which
     * the action should be applied.
     * @param {array} hashes
     * @return {promise} actionIsDone
     */
    this.start = function(torrents) {
        return doAction('d.start', torrents);
    }

    this.pause = function(torrents) {
        return doAction('d.pause', torrents);
    }

    this.resume = function(torrents) {
        return doAction('d.resume', torrents);
    }

    this.stop = function(torrents) {
        return doAction('d.try_stop', torrents);
    }

    this.close = function(torrents) {
        return doAction('d.close', torrents);
    }

    this.open = function(torrents) {
        return doAction('d.open', torrents);
    }

    this.label = function(torrents, label) {
        return doAction('d.set_custom1', torrents, label)
    }

    this.delete = function(torrents) {
        return doAction('d.erase', torrents)
    }

    this.recheck = function(torrents) {
        return doAction('d.check_hash', torrents)
    }

    this.priority = {}
    this.priority.high = function(torrents) {
        return doAction('d.set_priority', torrents, 3)
    }

    this.priority.normal = function(torrents) {
        return doAction('d.set_priority', torrents, 2)
    }

    this.priority.low = function(torrents) {
        return doAction('d.set_priority', torrents, 1)
    }

    this.priority.off = function(torrents) {
        return doAction('d.set_priority', torrents, 0)
    }

    /**
     * Whether the client supports sorting by trackers or not
     */
    this.enableTrackerFilter = true

    /**
     * Represents the buttons and GUI elements to be displayed in the top navigation bar of the windows.
     * You may customize the GUI to your liking or to better accommodate the specific bittorrent client.
     * Every action must have a click function that corresponds to an action like the one showed above.
     * An object in the array should consist of the following information:
     *      label [string]: Name of the button/element
     *      type [string]: Can be 'button' or 'dropdown' or 'labels'
     *      color [string]: Can be 'red', 'orange', 'yellow', 'olive', 'green', 'teal', 'blue', 'violet', 'purple', 'pink', 'brown', 'grey', 'black'
     *      click [function]: The function to be executed when the when the button/element is pressed
     *      icon [string]: The icon of the button. See here: http://semantic-ui.com/elements/icon.html
     */
    this.actionHeader = [
        {
            label: 'Start',
            type: 'button',
            color: 'green',
            click: this.resume,
            icon: 'play'
        },
        {
            label: 'Pause',
            type: 'button',
            color: 'yellow',
            click: this.pause,
            icon: 'pause'
        },
        {
            label: 'Stop',
            type: 'button',
            color: 'red',
            click: this.close,
            icon: 'stop'
        },
        {
            label: 'Labels',
            click: this.label,
            type: 'labels'
        }
    ]

    /**
     * Represents the actions available in the context menu. Can be customized to your liking or
     * to better accommodate your bittorrent client. Every action must have a click function implemented.
     * Each element has an:
     *      label [string]: The name of the action
     *      click [function]: The function to be executed when clicked
     *      icon [string]: The icon of the action. See here: http://semantic-ui.com/elements/icon.html
     */
    this.contextMenu = [
        {
            label: 'Recheck',
            click: this.recheck,
            icon: 'checkmark'
        },
        {
            label: 'Priority',
            menu: [
                {
                    label: 'High',
                    click: this.priority.high
                },
                {
                    label: 'Normal',
                    click: this.priority.normal
                },
                {
                    label: 'Low',
                    click: this.priority.low
                },
                {
                    label: 'Don\'t Download',
                    click: this.priority.off
                }
            ]
        },
        {
            label: 'Remove',
            click: this.delete,
            icon: 'remove'
        }
    ];

}]);
