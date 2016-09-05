'use strict';

angular.module('torrentApp').service('rtorrentService', ["$http", "$q", "xmlrpc", "TorrentR", "rtorrentConfig", "notificationService", function($http, $q, $xmlrpc, TorrentR, rtorrentConfig, $notify) {

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
        var defer = $q.defer();

        $xmlrpc.config({
            hostName: url(ip, port),
            pathName: "/RPC2"
        })

        var encoded = new Buffer(`${user}:${pass}`).toString('base64');
        $http.defaults.headers.common.Authorization = 'Basic ' + encoded;

        $xmlrpc.callMethod('system.client_version')
        .then(function(data) {
            config.version = data;
            console.log("Login success!", data);
            defer.resolve();
        }).catch(function(err) {
            console.error("Login error", err);
            defer.reject(err);
        })

        return defer.promise;
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
        var defer = $q.defer();

        $xmlrpc.callMethod('d.multicall', ['main', ...fields, ...custom])
        .then(function(data) {
            defer.resolve(processData(data));
        }).catch(function(err) {
            console.error("Torrent error", err);
            defer.reject(err);
        })

        return defer.promise;
    }

    function processData(data) {
        var torrents = {
            labels: [],
            all: [],
            changed: [],
            deleted: []
        };

        torrents.changed = data.map(build);
        torrents.labels = torrents.changed.reduce(fetchLabels, [])

        return torrents
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
        return
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
    this.uploadTorrent = function(blob, filename) {
        var formData = new FormData();
        formData.append('torrents', blob, filename);

        return $http.post('__url__', formData, {
            headers: { 'Content-Type': undefined },
            transformRequest: function(data) {
                return data;
            }
        });
    }

    function doAction(action, hashes) {
        var defer = $q.defer();

        var calls = []

        hashes.forEach(function(hash) {
            calls.push({
                'methodName': action,
                'params': [hash]
            })
        })

        $xmlrpc.callMethod('system.multicall', [calls])
        .then(function(data) {
            defer.resolve(data);
        }).catch(function(err) {
            console.error("Action error", err);
            defer.reject(err);
        })

        return defer.promise
    }

    /**
     * Example action function. You will have to implement several of these to support the various
     * actions in your bittorrent client. Each action is supplied an array of the hashes on which
     * the action should be applied.
     * @param {array} hashes
     * @return {promise} actionIsDone
     */
    this.start = function(hashes) {
        return doAction('d.start', hashes);
    }

    this.pause = function(hashes) {
        return doAction('d.pause', hashes);
    }

    this.resume = function(hashes) {
        return doAction('d.resume', hashes);
    }

    this.stop = function(hashes) {
        return doAction('d.try_stop', hashes);
    }

    this.close = function(hashes) {
        return doAction('d.close', hashes);
    }

    this.open = function(hashes) {
        return doAction('d.open', hashes);
    }

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
            click: this.setCategory,
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
            label: 'Move Up Queue',
            click: this.queueUp,
            icon: 'arrow up'
        },
        {
            label: 'Move Queue Down',
            click: this.queueDown,
            icon: 'arrow down'
        },
        {
            label: 'Remove',
            click: this.delete,
            icon: 'remove'
        }
    ];

}]);
