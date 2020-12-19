'use strict';

export let synologyService = ["$http", "$q", "TorrentS", "notificationService", function(
    $http, $q, TorrentS, $notify) {

    /*
     * Please rename all occurences of __serviceName__ (including underscores) with the name of your service.
     * Best practise is naming your service starting with the client name in lower case followed by 'Service'
     * (remember capital 'S' e.g qbittorrentService for qBittorrent, utorrentService for µTorrent ect.).
     * The real name of your client for display purposes can be changes in the field 'this.name' below.
     */
    this.name = 'Synology Download Station';

    // API vars.
    var authPath;
    var authVersion;
    var dlPath;
    var dlVersion;
    var taskPath = "/DownloadStation/task.cgi";

    var SYN_TIMEOUT = 6000;
    var API_INFO = "SYNO.API.Info";
    var API_TASK = "SYNO.DownloadStation.Task";
    var API_AUTH = "SYNO.API.Auth";

    /**
     * The config function is in charge of supplying config objects with
     * exactly the parameters needed for various HTTP GET calls.
     * For example, calling with the choice of 'auth' and acc and pwd in args
     * yields a matching config object in accordance to the Synology API Documentation.
     * @param  {string} choice The choice of what kind of config object is desired.
     * @param  {array} args   Arbitrary arguments for the config objects.
     * @return {object}       A config object for a HTTP GET call.
     */
    function config(choice, args?) {
        switch (choice) {
            case 'query':
                return {
                    params: {
                        "api": API_INFO,
                        "version": "1",
                        "method": "query",
                        "query": "SYNO.API.Auth,SYNO.DownloadStation.Task"},
                    timeout: SYN_TIMEOUT
                };
            case 'auth':
                return {
                    params: {
                        "api": API_AUTH,
                        "version": authVersion,
                        "method": "login",
                        "account": args[0],
                        "passwd": args[1],
                        "session": "DownloadStation"},
                    timeout: SYN_TIMEOUT
                };
            case 'torrents':
                return {
                    params: {
                        "api": API_TASK,
                        "version": dlVersion,
                        "method": "list",
                        "additional": "detail,transfer,tracker"},
                    timeout: SYN_TIMEOUT
                };
            case 'tUrl':
                return {
                    params: {
                        "api": API_TASK,
                        "version": dlVersion,
                        "method": "create",
                        "uri": args[0]},
                    timeout: SYN_TIMEOUT
                };
            case 'action':
                return {
                    params: {
                        "api": API_TASK,
                        "version": dlVersion,
                        "method": args[0],
                        "id": args[1]},
                    timeout: SYN_TIMEOUT
                };
        }
    }

    // Error objects that maps error codes to error information.
    var comErr = {
        100: "Unknown error.",
        101: "Invalid parameter.",
        102: "The requested API does not exist.",
        103: "The requested method does not exist.",
        104: "The requested version does not support the functionality.",
        105: "The logged in session does not have permission.",
        106: "Session timeout.",
        107: "Session interrupted by duplicate login."
    }

    var authErr = {
        400: "No such account or incorrect password.",
        401: "Account disabled.",
        402: "Permission denied.",
        403: "2-step verfication code required.",
        404: "Faield to authenticate 2-step verification code."
    }

    var taskErr = {
        400: "File upload failed.",
        401: "Max number of tasks reached.",
        402: "Destination denied.",
        403: "Destination does not exist.",
        404: "Invalid task id.",
        405: "Invalid task action.",
        406: "No default destination.",
        407: "Set destination failed.",
        408: "File does not exist."
    };

    function handleError(response) {
        var data = response.data;

        // Common or Authentication errors.
        if (data.hasOwnProperty('error')) {
            var code = data.error.code;
            if (comErr.hasOwnProperty(code)) {
                $notify.alert('Common Error!', comErr[code]);
            } else if (authErr.hasOwnProperty(code)) {
                $notify.alert('Authentication Error!', authErr[code]);
            }
        }

        // Task errors.
        if (Array.isArray(data.data)) {
            var errs = data.data.map(o => o.error);
            var singErr = errs.filter(c => c > 0);

            if (singErr.length === 1) {
                $notify.alert('Task Error!', taskErr[singErr[0]]);
            } else if (singErr.length > 1) {
                $notify.alert('Multiple Task Errors!', 'There were multiple errors associated with the task requested.');
            }
        }
        return response;
    }


    /**
     * Simple function without any explanation needed for the technical aspect
     * of it. However the function is needed an easy way of interpreting whether a call
     * to the SYNO API was successful or not.
     * This is only checkable in the response field "success".
     * @param  {String}  data Response from a SYNO API call.
     * @return {Boolean}      Selfexplanatory.
     */
    function isSuccess(data) {
        return data.success
    }

    /**
     * Connect to the server upon initial startup, changing connection settings ect. The function
     * should return a promise that the connection was successfull. A standard http timeout of 5 seconds
     * must be implemented. When successfull the service should save login details for later use. Check out
     * the helper function on the `server` object. Especially the `url()` function is useful.
     * @param {server} server
     * @return {promise} connection
     */
    this.connect = function(server) {
        this.server = server;
        var self = this;

        return $http.get(this.server.url() + "/query.cgi", config('query'))
            .then(handleError)
            .then(function(response) {
                if (isSuccess(response.data)) {
                    return {
                        auth: response.data.data[API_AUTH],
                        task: response.data.data[API_TASK]
                    };
                }
                return $q.reject("Getting initial API information from Auth and DownloadStation failed. Error: " + response.data.error);
            }).then(function(data) {
                /* Before login, API information is required on SYNO.Auth API.
                   Grab the DownloadStation API information as well.
                */
                authPath = "/" + data.auth.path;
                authVersion = data.auth.maxVersion;
                dlPath = "/" + data.task.path;
                dlVersion = data.task.maxVersion;

                // Lets login!
                return $http.get(self.server.url() + authPath, config('auth', [server.user, server.password]))
            }).then(handleError)
              .then(function(response) {
                if (isSuccess(response.data)) {
                    return $q.resolve(response);
                }
                return $q.reject("Login failed. Error: " + response.data.error);
            })
    }

    /**
     * Return any new information about torrents to be rendered in the GUI. Should return a
     * promise with the required information to be updated. Will be executed by controllers
     * very frequently. You can find a template of the data to be returned in the function.
     * Whenever boolean fullupdate is true this function should return a full list of all
     * the information from the client.
     * Returned information will have the following format:
     *      labels {array}: array of string of each label
     *      all {array}: array of objects inherited from 'AbstractTorrent' that are not currently known.
     *              This means they have just been added or never seen before since the last startup.
     *      changed {array}: array of objects inherited from 'AbstractTorrent' that have already been send before.
     *              This means they may contain partial information in which case they ar merged with any present infomation.
     *      deleted {array}: array of string containg the hashes of which torrents to be removed from the list in the GUI.
     * @param {boolean} fullupdate
     * @return {promise} data
     */
    this.torrents = function() {
        // Retrieve info of all torrents in DownloadStation
        return $http.get(this.server.url() + dlPath, config('torrents'))
            .then(handleError)
            .then(function(response) {
                if (isSuccess(response.data)) {
                    return $q.resolve(processData(response.data.data));
                }
                return $q.reject("Retrieving torrent data failed. Error: " + response.data.error);
            })
    }


    /*
    Take all the data retrieved by torrents() and create TorrentS objects from it.
    Uses dirty tag since Synology gives all data for all torrents in the system back at once and not in groups like "deleted".
     */
    function processData(data) {
        var torrents = {
            dirty: true,
            labels: [],
            all: [],
            changed: [],
            deleted: []
        };
        // data is JSON formatted and contains "tasks" : array of json objects containing each individual torrent information.
        var tasks = data.tasks;
        torrents.all = tasks.map(build);
        return torrents;
    }

    // Takes a raw JSON object (torrent info) and converts it to a TorrentS object.
    function build(data) {
        return new TorrentS(data)
    }

    /**
     * Returns the default path for the service. Should start with a slash.
     @return {string} the default path
     */
    this.defaultPath = function() {
        return "/webapi";
    }

    /**
     * Add a torrent to the client by sending a magnet link to the API. Should return
     * a promise that the torrent has been added successfully to the client.
     * @param {string} magnetURL
     * @return {promise} isAdded
     */
    this.addTorrentUrl = function(magnet) {
        // Contradicts API documentation by using GET instead of POST. However, POST doesn't work.
        return $http.get(this.server.url() + taskPath, config('tUrl', [magnet]))
            .then(handleError)
            .then(function(response) {
                // Check response for success.
                if(isSuccess(response.data)) {
                    return $q.resolve();
                }
                // Create failed, reject with the error code provided
                return $q.reject(
                    "Create a DownloadStation task with the provided URL failed. Error: " + response.data.error);
        })
    }

    /**
     * Add a torrent file with the .torrent extension to the client through the API. Should
     * return a promise that the torrent was added sucessfully. File data is given as an nodejs buffer
     * more information here: https://nodejs.org/api/buffer.html. You may use
     * the existing implementation as a helping hand
     * @param {blob} filedata
     * @param {string} filename
     * @return {promise} isAdded
     */
    this.uploadTorrent = function(buffer, filename) {
        var blob = new Blob([buffer], {
            type: 'application/x-bittorrent'
        })

        var formData = new FormData();
        formData.append('api', API_TASK);
        formData.append('version', dlVersion);
        formData.append('method', "create");
        formData.append('file', blob, filename);

        return $http.post(this.server.url() + taskPath, formData, {
                headers: { 'Content-Type': undefined },
                transformRequest: function(data) {
                    return data;
                }
        })
    }

    /**
     * doAction contains the standard implementation for manipulating with torrents in the Synology WebAPI.
     * @param  {string} action Selfexplanatory, can be start, pause or delete.
     * @return {promise}       [description]
     */
    this.doAction = function(action, torrents) {
        // Retreive the ID's of the torrents (TorrentS.hash)
        var ids = torrents.map(t => t.hash);
        var idsStr = ids.join(",");

        return $http.get(this.server.url() + taskPath, config('action', [action, idsStr]))
            .then(handleError)
            .then(function(response) {
                    return $q.resolve();
            })
    }

    /**
     * Example action function. You will have to implement several of these to support the various
     * actions in your bittorrent client. Each action is supplied an array of the torrents on which
     * the action should be applied. The torrent object is the same type of object which you implemented
     * alongside your service (e.g. TorrentU for µTorrent, TorrentQ for qBittorrent ect...)
     * @param {array} torrents
     * @return {promise} actionIsDone
     */
    this.start = function(torrents) {
        return this.doAction("resume", torrents);
    }

    this.pause = function(torrents) {
        return this.doAction("pause", torrents);
    }

    this.remove = function(torrents) {
        return this.doAction("delete", torrents);
    }

    /**
     * Whether the client supports sorting by trackers or not
     */
    this.enableTrackerFilter = false

    /**
     * Provides the option to include extra columns for displaying data. This may concern columns
     * which are specific to this client. The extra columns will be merged with the default columns.
     */
    this.extraColumns = []

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
            label: 'Pause',
            type: 'button',
            color: 'yellow',
            click: this.pause,
            icon: 'pause'
        }

    ]

    /**
     * Represents the actions available in the context menu. Can be customized to your liking or
     * to better accommodate your bittorrent client. Every action must have a click function implemented.
     * Each element has an:
     *      label [string]:     The name of the action
     *      click [function]:   The function to be executed when clicked
     *      icon [string]:      The icon of the action. See here: http://semantic-ui.com/elements/icon.html
     *      check [function]:   Displays a checkbox instead of an icon. The function is a predicate which
     *                          has to hold for all selected torrents, for the checkbox to be checked.
     */
    this.contextMenu = [
        {
            label: 'Remove Torrent',
            click: this.remove,
            icon: 'remove'
        }
    ];

}]
