'use strict';

angular.module('torrentApp').service('rtorrentService', ["$http", "$q", "xmlrpc", "TorrentR", "rtorrentConfig", "rtorrentRpc", "notificationService", "Column", function($http, $q, $xmlrpc, TorrentR, rtorrentConfig, rtorrentRpc_old, $notify, Column) {

    const Rtorrent = require('node-rtorrent')
    const { Remote } = require('./lib/worker')

    let rtorrent = null
    let worker = new Worker('scripts/workers/rtorrent.js')

    const URL_REGEX = /^[a-z]+:\/\/(?:[a-z0-9-]+\.)*((?:[a-z0-9-]+\.)[a-z]+)/

    /*
     * Please rename all occurences of __serviceName__ (including underscores) with the name of your service.
     * Best practise is naming your service starting with the client name in lower case followed by 'Service'
     * (remember capital 'S' e.g qbittorrentService for qBittorrent, utorrentService for µTorrent ect.).
     * The real name of your client for display purposes can be changes in the field 'this.name' below.
     */
    this.name = 'rTorrent';


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
    this.connect = function(server) {

        rtorrent = new Remote(Rtorrent.prototype, worker)

        return rtorrent.instantiate({
            host: server.ip,
            port: server.port,
            path: server.cleanPath(),
            user: server.user,
            pass: server.password
        }).then(function() {
            return rtorrent.get('system.client_version', [])
        })

    }

    /**
     * Returns the default path for the service. Should start with a slash.
     @return {string} the default path
     */
    this.defaultPath = function() {
      return "/RPC2"
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
        var torrents = {
            dirty: true,
            labels: [],
            all: [],
            changed: [],
            deleted: []
        };

        return rtorrent.getTorrentsExtra()
            .then(function(data) {
                console.log(data)
                torrents.all = data.torrents.map(d => new TorrentR(d))
                torrents.trackers = data.trackers
                torrents.labels = data.labels
                return torrents
            }).catch(function(err) {
                console.error(err)
                throw new Error(err)
            })
        // let torrents = null
        // return $xmlrpc.callMethod('d.multicall', ['main', ...fields, ...custom])
        //     .then(function(data) {
        //         torrents = processData(data)
        //         return $q.resolve(torrents);
        //     }).then(function(torrents) {
        //         return getTrackers(torrents.all)
        //     }).then(function(trackers) {
        //         torrents.trackers = trackers
        //         return $q.resolve(torrents)
        //     }).catch(function(err) {
        //         console.error("Torrent error", err);
        //         return $q.reject(err);
        //     })

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
            _.each(_.pluck(trackerArray, 'get_url'), function(trackerUrl) {
                trackers.add(trackerUrl)
            })
        })
        var trackerArray = Array.from(trackers).map((tracker) => {
            return parseUrl(tracker)
        })
        return _.compact(trackerArray)
    }

    function parseUrl(url) {
        var match = url.match(URL_REGEX)
        return match && match[1]
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
        return rtorrent.loadLink(magnet)
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
    this.uploadTorrent = function(buffer /*, filename*/) {
        buffer = Buffer.from(buffer)
        return rtorrent.loadFileContent(buffer)
    }

    function doAction(actions, torrents, params) {

        var hashes = torrents.map(function(torrent) {
            return torrent.hash
        })

        var calls = []

        hashes.forEach(function(hash) {
            if (!Array.isArray(actions)) {
                actions = [actions]
                params = [params]
            }

            actions.forEach(function(action, idx) {
                var call = {
                    'methodName': action,
                    'params': [hash]
                }

                if (params[idx] !== undefined) call.params.push(params[idx])

                calls.push(call)
            })
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
        return rtorrent.start(torrents.map(t => t.hash))
    }

    this.stop = function(torrents) {
        return rtorrent.stop(torrents.map(t => t.hash))
    }

    this.label = function(torrents, label) {
        return rtorrent.setLabel(torrents.map(t => t.hash), label)
    }

    this.remove = function(torrents) {
        return rtorrent.remove(torrents.map(t => t.hash))
    }

    this.deleteAndErase = function(torrents) {
        return rtorrent.removeAndErase(torrents.map(t => t.hash))
    }

    this.recheck = function(torrents) {
        return rtorrent.recheck(torrents.map(t => t.hash))
    }

    this.priority = {}
    this.priority.high = function(torrents) {
        return rtorrent.setPriorityHigh(torrents.map(t => t.hash))
    }

    this.priority.normal = function(torrents) {
        return rtorrent.setPriorityNormal(torrents.map(t => t.hash))
    }

    this.priority.low = function(torrents) {
        return rtorrent.setPriorityLow(torrents.map(t => t.hash))
    }

    this.priority.off = function(torrents) {
        return rtorrent.setPriorityOff(torrents.map(t => t.hash))
    }

    /**
     * Whether the client supports sorting by trackers or not
     */
    this.enableTrackerFilter = true

    /**
     * Provides the option to include extra columns for displaying data. This may concern columns
     * which are specific to this client. The extra columns will be merged with the default columns.
     */
    this.extraColumns = [
        new Column({
            name: 'Tracker',
            attribute: 'tracker',
            template: '{{ torrent.tracker }}',
            sort: Column.ALPHABETICAL
        })
    ]

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
            click: this.start,
            icon: 'play'
        },
        {
            label: 'Stop',
            type: 'button',
            color: 'red',
            click: this.stop,
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
            click: this.remove,
            icon: 'remove'
        },
        {
            label: 'Remove and Delete',
            click: this.deleteAndErase,
            icon: 'trash'
        }
    ];

}]);
