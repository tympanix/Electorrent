
export let delugeService = ["TorrentD", "$q", "$remote", "notificationService", function(TorrentD, $q, $remote, $notify) {

    const Deluge = require('@electorrent/node-deluge')
    const worker = new Worker('scripts/workers/deluge.js')

    /*
     * Please rename all occurences of __serviceName__ (including underscores) with the name of your service.
     * Best practise is naming your service starting with the client name in lower case followed by 'Service'
     * (remember capital 'S' e.g qbittorrentService for qBittorrent, utorrentService for µTorrent ect.).
     * The real name of your client for display purposes can be changes in the field 'this.name' below.
     */
    this.name = 'Deluge';

    /*
     * Global reference to the deluge remote web worker instance
     */
    let deluge = null


    /**
     * Connect to the server upon initial startup, changing connection settings ect. The function
     * should return a promise that the connection was successfull. A standard http timeout of 5 seconds
     * must be implemented. When successfull the service should save login details for later use. Check out
     * the helper function on the `server` object. Especially the `url()` function is useful.
     * @param {server} server
     * @return {promise} connection
     */
    this.connect = function(server) {
        deluge = new $remote(Deluge.prototype, worker)

        let ca = server.getCertificate()

        return deluge.instantiate({
            host: server.url(),
            port: server.port,
            path: server.cleanPath(),
            pass: server.password,
            ca: ca,
        }).then(function() {
            return deluge.login()
        }).then(function() {
            // Connect to server #0 by default
            return deluge.connect(0)
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
        return deluge.getTorrents().then((data) => {
            var torrents = {
                labels: [],
                all: [],
                changed: [],
                deleted: [],
                dirty: true,
            };

            for (const hash of Object.keys(data.torrents || {})) {
                torrents.all.push(new TorrentD(hash, data.torrents[hash]))
            }

            return torrents
        })
    }

    /**
     * Returns the default path for the service. Should start with a slash.
     @return {string} the default path
     */
    this.defaultPath = function() {
      return "/"
    }

    /**
     * Add a torrent to the client by sending a magnet link to the API. Should return
     * a promise that the torrent has been added successfully to the client.
     * @param {string} magnetURL
     * @return {promise} isAdded
     */
    this.addTorrentUrl = function(magnet) {
        return deluge.addTorrentURL(magnet, {})
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
        return deluge.addTorrent(buffer, {})
    }

    /**
     * Example action function. You will have to implement several of these to support the various
     * actions in your bittorrent client. Each action is supplied an array of the torrents on which
     * the action should be applied. The torrent object is the same type of object which you implemented
     * alongside your service (e.g. TorrentU for µTorrent, TorrentQ for qBittorrent ect...)
     * @param {array} torrents
     * @return {promise} actionIsDone
     */
    this.resume = function(torrents) {
        return deluge.resume(torrents.map(t => t.hash))
    }

    this.pause = function(torrents) {
        return deluge.pause(torrents.map(t => t.hash))
    }

    this.verify = function(torrents) {
        return deluge.verify(torrents.map(t => t.hash))
    }

    this.remove = function(torrents) {
        return deluge.remove(torrents.map(t => t.hash))
    }

    this.removeAndDelete = function(torrents) {
        return deluge.removeAndDelete(torrents.map(t => t.hash))
    }

    this.queueUp = function(torrents) {
        return deluge.queueUp(torrents.map(t => t.hash))
    }

    this.queueDown = function(torrents) {
        return deluge.queueDown(torrents.map(t => t.hash))
    }

    this.queueTop = function(torrents) {
        return deluge.queueTop(torrents.map(t => t.hash))
    }

    this.queueBottom = function(torrents) {
        return deluge.queueBottom(torrents.map(t => t.hash))
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
            click: this.resume,
            icon: 'play',
            role: 'resume'
        },
        {
            label: 'Pause',
            type: 'button',
            color: 'red',
            click: this.pause,
            icon: 'pause',
            role: 'stop'
        },
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
            label: 'Verify',
            click: this.verify,
            icon: 'checkmark'
        },
        {
            label: 'Move Queue Up',
            click: this.queueUp,
            icon: 'arrow up'
        },
        {
            label: 'Move Queue Down',
            click: this.queueDown,
            icon: 'arrow down'
        },
        {
            label: 'Queue Top',
            click: this.queueTop,
            icon: 'chevron circle up'
        },
        {
            label: 'Queue Bottom',
            click: this.queueBottom,
            icon: 'chevron circle down'
        },
        {
            label: 'Remove',
            click: this.remove,
            icon: 'remove'
        },
        {
            label: 'Remove and delete',
            click: this.removeAndDelete,
            icon: 'trash',
            role: 'delete'
        },
    ];

}];
