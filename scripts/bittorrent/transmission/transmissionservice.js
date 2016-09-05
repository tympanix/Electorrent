'use strict';

angular.module('torrentApp')
    .service('transmissionService', ["$http", "$q", "TorrentT", "notificationService", function($http, $q, TorrentT, $notify) {

    /*
     * Please rename all occurences of __serviceName__ (including underscores) with the name of your service.
     * Best practise is naming your service starting with the client name in lower case followed by 'Service'
     * (remember capital 'S' e.g qbittorrentService for qBittorrent, utorrentService for µTorrent ect.).
     * The real name of your client for display purposes can be changes in the field 'this.name' below.
     */
    this.name = 'Transmission';

    /*
     * Good practise is keeping a configuration object for your communication with the API
     */
    const config = {
        ip: '',
        port: '',
        session: undefined,
        encoded: '',
    }

    var tempDeleted = [];

/*    const httpConfig = {
        headers:{
            'Authorization':'Basic ' + config.encoded,
            'X-Transmission-Session-Id': config.session
        }
    }
*/
    function url() {
        var ip, port, path;
        if (arguments.length <= 1){
            ip = config.ip;
            port = config.port;
            path = arguments[0] || "";
        } else {
            ip = arguments[0]
            port = arguments[1]
            path = arguments[2] || "";
        }
        return `http://${ip}:${port}/transmission/rpc${path}`;
    }

    function updateSession(session) {
        if (!session) return;
        config.session = session;
        console.log("New session", config.session);
    }

    function saveConnection(ip, port, encoded, session) {
        config.ip = ip;
        config.port = port;
        config.encoded = encoded;
        config.session = session;
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
        var encoded = new Buffer(`${user}:${pass}`).toString('base64');

        $http.get(url(ip,port),{
            timeout: 5000,
            headers: {
                'Authorization': "Basic " + encoded
            }

        }).success(function(str, status, headers) {
            var session = headers('X-Transmission-Session-Id');
            saveConnection(ip, port, encoded, session);
            defer.resolve(str);
        }).error(function(err, status, headers, config, statustext){
            if(status === 409){
                var session = headers('X-Transmission-Session-Id');
                saveConnection(ip, port, encoded, session);
                console.log("Session has been saved", config.session);
                defer.resolve(err);
                return ;
            }
            defer.reject(err);

        });

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

        // downloadedEver and uploadedEver continue to count the second time you download that torrent.
        var fields = ['id','name','totalSize','percentDone', 'downloadedEver',
        'uploadedEver', 'uploadRatio','rateUpload','rateDownload','eta','comment'
        ,'peersConnected','maxConnectedPeers','peersGettingToUs','seedsGettingFromUs'
        ,'queuePosition','status','addedDate','doneDate','downloadDir','recheckProgress'
        , 'isFinished','priorities'];

        var data = {

            "arguments": {
	               "fields": fields
               },
            "method": "torrent-get"
	     }

        $http.post(url(),data,{
            headers:{
                'Authorization':'Basic ' + config.encoded,
                'X-Transmission-Session-Id': config.session
            }
        }).success(function(data, status, headers) {
            var session = headers('X-Transmission-Session-Id');
            updateSession(session);
            defer.resolve(processData(data));
        }).error(function(err){
            defer.reject(err);
        });

        return defer.promise;

    }

    function processData(data){
        var torrents = {
            labels: [],
            all: [],
            changed: [],
            deleted: []
        };
        var newTorrents = data.arguments.torrents;
        torrents.changed = newTorrents.map(build);
        return torrents;
    }

    function build(data){
        return new TorrentT(data);
    }

    /**
     * Add a torrent to the client by sending a magnet link to the API. Should return
     * a promise that the torrent has been added successfully to the client.
     * @param {string} magnetURL
     * @return {promise} isAdded
     */
    this.addTorrentUrl = function(magnet) {
        var defer = $q.defer();

        // Torrent-add
        var data = {
            "arguments": {
                "filename": magnet
            },
            "method": "torrent-add"
        }

        return $http.post(url(), data, {
            headers:{
                'Authorization':'Basic ' + config.encoded,
                'X-Transmission-Session-Id': config.session
            }
        }).success(function(responeData, status, headers){
            var session = headers('X-Transmission-Session-Id');
            updateSession(session);
            if ('torrent-duplicate' in responseData.arguments) throw new Error('torrentDuplicate')
            defer.resolve(processData(data));
        }).catch(function(err){
            if (err.message === 'torrentDuplicate'){
                $notify.alert('Duplicate!',' This torrent is already added. Name: '
                + responseData.arguments['torrent-duplicate'].name);
            } else {
                $notify.alert('Undefined error!', err.msg);
            }

        })

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

    function doAction(command, torrents, mutator, value) {
        if (!Array.isArray(torrents)) {
            return $notify.alert('Error', 'Action was passed incorrect arguments')
        }

        var torrents = torrents || [];

        var hashes = torrents.map(function(torrent) {
            return torrent.hash
        })

        var data = {
            "arguments": {},
            "method": command
        }

        if (hashes.length){
            data.arguments.ids = hashes;
        }

        if (mutator) {
            data.arguments[mutator] = value;
        }

        return $http.post(url(), data, {
            headers: {
                'Authorization': 'Basic ' + config.encoded,
                'X-Transmission-Session-Id': config.session
            }
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
        return doAction('torrent-start', torrents);
    }

    this.stop = function(torrents) {
        return doAction('torrent-stop', torrents);
    }

    this.verify = function(torrents) {
        return doAction('torrent-verify', torrents);
    }

    this.pauseAll = function() {
        return doAction('torrent-stop');
    }

    this.resumeAll = function() {
        return doAction('torrent-start');
    }

    this.queueUp = function(torrents) {
        return doAction('queue-move-up', torrents);
    }

    this.queueDown = function(torrents) {
        return doAction('queue-move-down', torrents);
    }

    this.setCategory = function(torrents, label) {
        return ;
    }

    this.remove = function(torrents) {
        return doAction('torrent-remove', torrents)
    }

    this.removeAndLocal = function(torrents) {
        return doAction('torrent-remove', torrents, 'delete-local-data', true)
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
            click: this.start,
            icon: 'play'
        },
        {
            label: 'Stop',
            type: 'button',
            color: 'red',
            click: this.stop,
            icon: 'pause'
        },
        {
            label: 'More',
            type: 'dropdown',
            color: 'blue',
            icon: 'plus',
            actions: [
                {
                    label: 'Pause All',
                    click: this.pauseAll
                },
                {
                    label: 'Resume All',
                    click: this.resumeAll
                }
            ]
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
            label: 'Start',
            click: this.start,
            icon: 'play'
        },
        {
            label: 'Pause',
            click: this.stop,
            icon: 'pause'
        },
        {
            label: 'Verify',
            click: this.verify,
            icon: 'checkmark'
        },
        /*{
            label: 'Priority',
            menu: [
                {
                    label: 'High',
                    click: this.priorityHigh
                },
                {
                    label: 'Normal',
                    click: this.priorityNormal
                },
                {
                    label: 'Low',
                    click: this.priorityLow
                }
            ]

        }*/,
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
            menu: [
                {
                    label: 'Torrent',
                    icon: 'remove',
                    click: this.remove
                },
                {
                    label: 'Torrent and Local Data',
                    icon: 'remove',
                    click: this.removeAndLocal
                }
            ]
        }
    ];

}]);
