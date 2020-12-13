"use strict";

angular.module("torrentApp").service("qbittorrentService", [ "$q", "$remote", "TorrentQ", "notificationService",
  function ($q, $remote, Torrent, $notify) {
    const QBittorrent = require("@electorrent/node-qbittorrent");
    const worker = new Worker("scripts/workers/qbittorrent.js");

    /*
     * Global reference to the qbittorrent remote web worker instance
     */
    let qbittorrent = null;

    /*
     * Please rename all occurences of __serviceName__ (including underscores) with the name of your service.
     * Best practise is naming your service starting with the client name in lower case followed by 'Service'
     * (remember capital 'S' e.g qbittorrentService for qBittorrent, utorrentService for µTorrent ect.).
     * The real name of your client for display purposes can be changes in the field 'this.name' below.
     */
    this.name = "qBittorrent";

    /**
     * Connect to the server upon initial startup, changing connection settings ect. The function
     * should return a promise that the connection was successfull. A standard http timeout of 5 seconds
     * must be implemented. When successfull the service should save login details for later use. Check out
     * the helper function on the `server` object. Especially the `url()` function is useful.
     * @param {server} server
     * @return {promise} connection
     */
    this.connect = function (server) {
      qbittorrent = new $remote(QBittorrent.prototype, worker);

      let ca = server.getCertificate();

      return qbittorrent
        .instantiate({
          host: server.url(),
          port: server.port,
          path: server.cleanPath(),
          user: server.user,
          pass: server.password,
          ca: ca,
        })
        .then(function () {
          return qbittorrent.login();
        });
    };

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
    this.torrents = function (fullupdate) {
      let promise = fullupdate ? qbittorrent.reset() : $q.when();

      return promise
        .then(() => {
          return qbittorrent.syncMaindata();
        })
        .then((data) => {
          return processData(data);
        });
    };

    function processData(data) {
      var torrents = {
        labels: [],
        all: [],
        changed: [],
        deleted: [],
      };

      if (Array.isArray(data.categories) || Array.isArray(data.labels)) {
        torrents.labels = data.categories || data.labels;
      } else if (typeof data.categories === "object") {
        torrents.labels = Object.values(data.categories).map((c: any) => c.name);
      }

      if (data.full_update) {
        torrents.all = buildAll(data.torrents);
      } else {
        torrents.changed = buildAll(data.torrents);
      }

      torrents.deleted = data.torrents_removed || [];
      return torrents;
    }

    function buildAll(torrents) {
      if (!torrents) return [];

      var torrentArray = [];

      Object.keys(torrents).map(function (hash) {
        var torrent = new Torrent(hash, torrents[hash]);
        torrentArray.push(torrent);
      });

      return torrentArray;
    }

    /**
     * Returns the default path for the service. Should start with a slash.
     @return {string} the default path
     */
    this.defaultPath = function () {
      return "/";
    };

    /**
     * Add a torrent to the client by sending a magnet link to the API. Should return
     * a promise that the torrent has been added successfully to the client.
     * @param {string} magnetURL
     * @return {promise} isAdded
     */
    this.addTorrentUrl = function (magnet) {
      return qbittorrent.addTorrentURL(magnet, {});
    };

    /**
     * Add a torrent file with the .torrent extension to the client through the API. Should
     * return a promise that the torrent was added sucessfully. File data is given as an nodejs buffer
     * more information here: https://nodejs.org/api/buffer.html. You may use
     * the existing implementation as a helping hand
     * @param {blob} filedata
     * @param {string} filename
     * @return {promise} isAdded
     */
    this.uploadTorrent = function (buffer, filename) {
      buffer = Buffer.from(buffer);
      return qbittorrent.addTorrentFileContent(buffer, filename, {});
    };

    /**
     * Whether the client supports sorting by trackers or not
     */
    this.enableTrackerFilter = false;

    /**
     * Provides the option to include extra columns for displaying data. This may concern columns
     * which are specific to this client. The extra columns will be merged with the default columns.
     */
    this.extraColumns = [];

    /*
     * Actions
     */
    this.resume = function (torrents) {
      return qbittorrent.resume(torrents.map((t) => t.hash));
    };

    this.resumeAll = function (torrents) {
      return qbittorrent.resumeAll();
    };

    this.pause = function (torrents) {
      return qbittorrent.pause(torrents.map((t) => t.hash));
    };

    this.pauseAll = function (torrents) {
      return qbittorrent.pauseAll();
    };

    this.recheck = function (torrents) {
      return qbittorrent.recheck(torrents.map((t) => t.hash));
    };

    this.increasePrio = function (torrents) {
      return qbittorrent.increasePrio(torrents.map((t) => t.hash));
    };

    this.decreasePrio = function (torrents) {
      return qbittorrent.decreasePrio(torrents.map((t) => t.hash));
    };

    this.topPrio = function (torrents) {
      return qbittorrent.topPrio(torrents.map((t) => t.hash));
    };

    this.bottomPrio = function (torrents) {
      return qbittorrent.bottomPrio(torrents.map((t) => t.hash));
    };

    this.toggleSequentialDownload = function (torrents) {
      return qbittorrent.toggleSequentialDownload(torrents.map((t) => t.hash));
    };

    this.delete = function (torrents) {
      return qbittorrent.delete(torrents.map((t) => t.hash));
    };

    this.deleteAndRemove = function (torrents) {
      return qbittorrent.deleteAndRemove(torrents.map((t) => t.hash));
    };

    this.setCategory = function (torrents, category, create) {
      var promise = $q.when();
      if (create === true) {
        promise = promise.then(() => qbittorrent.createCategory(category, ""));
      }
      var hashes = torrents.map((t) => t.hash);
      return promise.then(() => qbittorrent.setCategory(hashes, category));
    };

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
        label: "Start",
        type: "button",
        color: "green",
        click: this.resume,
        icon: "play",
        role: "resume",
      },
      {
        label: "Pause",
        type: "button",
        color: "red",
        click: this.pause,
        icon: "pause",
        role: "stop",
      },
      {
        label: "More",
        type: "dropdown",
        color: "blue",
        icon: "plus",
        actions: [
          {
            label: "Pause All",
            click: this.pauseAll,
          },
          {
            label: "Resume All",
            click: this.resumeAll,
          },
        ],
      },
      {
        label: "Labels",
        click: this.setCategory,
        type: "labels",
      },
    ];

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
        label: "Recheck",
        click: this.recheck,
        icon: "checkmark",
      },
      {
        label: "Move Up Queue",
        click: this.increasePrio,
        icon: "arrow up",
      },
      {
        label: "Move Queue Down",
        click: this.decreasePrio,
        icon: "arrow down",
      },
      {
        label: "Queue Top",
        click: this.topPrio,
        icon: "chevron circle up",
      },
      {
        label: "Queue Bottom",
        click: this.bottomPrio,
        icon: "chevron circle down",
      },
      {
        label: "Sequential Download",
        click: this.toggleSequentialDownload,
        check: function (torrent) {
          return torrent.sequentialDownload;
        },
      },
      {
        label: "Remove",
        click: this.delete,
        icon: "remove",
      },
      {
        label: "Remove And Delete",
        click: this.deleteAndRemove,
        icon: "trash",
        role: "delete",
      },
    ];
  },
]);
