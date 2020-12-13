"use strict";

angular.module("torrentApp").service("transmissionService", [
  "$http",
  "$q",
  "TorrentT",
  "transmissionConfig",
  "notificationService",
  function ($http, $q, TorrentT, transmissionConfig, $notify) {
    const URL_REGEX = /^[a-z]+:\/\/(?:[a-z0-9-]+\.)*((?:[a-z0-9-]+\.)[a-z]+)/;

    this.server = undefined;

    /*
     * Please rename all occurences of __serviceName__ (including underscores) with the name of your service.
     * Best practise is naming your service starting with the client name in lower case followed by 'Service'
     * (remember capital 'S' e.g qbittorrentService for qBittorrent, utorrentService for µTorrent ect.).
     * The real name of your client for display purposes can be changes in the field 'this.name' below.
     */
    this.name = "Transmission";

    /*
     * Good practise is keeping a configuration object for your communication with the API
     */
    const config = {
      ip: "",
      port: "",
      session: undefined,
      encoded: "",
    };

    function bufferToUnit8Array(buf) {
      if (!buf) return undefined;
      if (buf.constructor.name === "Uint8Array" || buf.constructor === Uint8Array) {
        return buf;
      }
      if (typeof buf === "string") buf = Buffer.from(buf);
      var a = new Uint8Array(buf.length);
      for (var i = 0; i < buf.length; i++) a[i] = buf[i];
      return a;
    }

    const fields = transmissionConfig.fields;

    this.url = function (path) {
      return `${this.server.url()}${path || ""}`;
    };

    function updateSession(session) {
      if (!session) return;
      config.session = session;
    }

    this.saveSession = function (session) {
      config.session = session;
    };

    /**
     * Returns the default path for the service. Should start with a slash.
     @return {string} the default path
     */
    this.defaultPath = function () {
      return "/transmission/rpc";
    };

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
    this.connect = function (server) {
      this.server = server;
      let self = this;
      var defer = $q.defer();
      var encoded = new Buffer(`${server.user}:${server.password}`).toString("base64");
      config.encoded = encoded;

      var data = {
        method: "session-get",
      };

      $http
        .post(this.url(), data, {
          timeout: 5000,
          headers: {
            Authorization: "Basic " + encoded,
          },
        })
        .then(function (response) {
          var session = response.headers("X-Transmission-Session-Id");
          self.saveSession(session);
          defer.resolve(response);
        })
        .catch(function (response) {
          if (response.status === 409) {
            var session = response.headers("X-Transmission-Session-Id");
            self.saveSession(session);
            return defer.resolve(response);
          }
          defer.reject(response);
        });

      return defer.promise;
    };

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
    this.torrents = function () {
      var defer = $q.defer();

      // downloadedEver and uploadedEver continue to count the second time you download that torrent.

      /*var fields = ['id','name','totalSize','percentDone', 'downloadedEver',
        'uploadedEver', 'uploadRatio','rateUpload','rateDownload','eta','comment',
        'peersConnected','maxConnectedPeers','peersGettingToUs','seedsGettingFromUs',
        'queuePosition','status','addedDate','doneDate','downloadDir','recheckProgress',
        'isFinished','priorities'];
        */
      var data = {
        arguments: {
          fields: fields,
        },
        method: "torrent-get",
      };

      $http
        .post(this.url(), data, {
          headers: {
            Authorization: "Basic " + config.encoded,
            "X-Transmission-Session-Id": config.session,
          },
        })
        .success(function (data, status, headers) {
          var session = headers("X-Transmission-Session-Id");
          updateSession(session);
          defer.resolve(processData(data));
        })
        .error(function (err) {
          defer.reject(err);
        });

      return defer.promise;
    };

    function processData(data) {
      var torrents = {
        dirty: true,
        labels: [],
        all: [],
        changed: [],
        deleted: [],
        trackers: [],
      };
      torrents.all = data.arguments.torrents.map(build);
      torrents.trackers = getTrackers(torrents.all);
      return torrents;
    }

    function build(data) {
      return new TorrentT(data);
    }

    function getTrackers(torrents) {
      let trackers = new Set();
      torrents.forEach((torrent) => {
        torrent.trackers.forEach((tracker) => trackers.add(tracker));
      });
      var trackerArray = Array.from(trackers).map(function (tracker) {
        return parseUrl(tracker);
      });
      return _.compact(trackerArray);
    }

    function parseUrl(url) {
      var match = url.match(URL_REGEX);
      return match && match[1];
    }

    /**
     * Add a torrent to the client by sending a magnet link to the API. Should return
     * a promise that the torrent has been added successfully to the client.
     * @param {string} magnetURL
     * @return {promise} isAdded
     */
    this.addTorrentUrl = function (magnet) {
      // Torrent-add
      var data = {
        arguments: {
          filename: magnet,
        },
        method: "torrent-add",
      };

      return $http
        .post(this.url(), data, {
          headers: {
            Authorization: "Basic " + config.encoded,
            "X-Transmission-Session-Id": config.session,
          },
        })
        .then(function (response) {
          var session = response.headers("X-Transmission-Session-Id");
          updateSession(session);
          if ("torrent-duplicate" in response.data.arguments) return $q.reject("torrentDuplicate");
          return $q.resolve();
        })
        .catch(function (err) {
          if (err === "torrentDuplicate") {
            $notify.alert("Duplicate!", " This torrent is already added");
          } else {
            $notify.alert("Undefined error!", err);
          }
          return $q.reject();
        });
    };

    /**
     * Add a torrent file with the .torrent extension to the client through the API. Should
     * return a promise that the torrent was added sucessfully. File data is given as a blob
     * more information here: https://developer.mozilla.org/en/docs/Web/API/Blob. You may use
     * the existing implementation as a helping hand
     * @param {blob} filedata
     * @param {string} filename
     * @return {promise} isAdded
     */
    this.uploadTorrent = function (buffer) {
      let self = this;
      var defer = $q.defer();
      let array = bufferToUnit8Array(Buffer.from(buffer));
      var blob = new Blob([array]);
      var base64data = "";

      // Convert blob file object to base64 encoded.
      var reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = function () {
        /* The use of split is necessary because the reader returns the type of the data
         * in the same string as the actual data, but we only need to send the actual data.*/
        base64data = reader.result.toString().split(",")[1];

        // Torrent-add
        var data = {
          arguments: {
            metainfo: base64data,
          },
          method: "torrent-add",
        };

        $http
          .post(self.url(), data, {
            headers: {
              Authorization: "Basic " + config.encoded,
              "X-Transmission-Session-Id": config.session,
            },
          })
          .then(function (response) {
            var session = response.headers("X-Transmission-Session-Id");
            updateSession(session);
            if ("torrent-duplicate" in response.data.arguments) return $q.reject("torrentDuplicate");
            defer.resolve();
          })
          .catch(function (err) {
            if (err === "torrentDuplicate") {
              $notify.alert("Duplicate!", " This torrent is already added.");
            } else {
              $notify.alert("Undefined error!", err.msg);
            }
            defer.reject();
          });
      };

      return defer.promise;
    };

    this.doAction = function (command, torrents, mutator, value) {
      if (!Array.isArray(torrents)) {
        return $notify.alert("Error", "Action was passed incorrect arguments");
      }

      var hashes = torrents.map(function (torrent) {
        return torrent.hash;
      });

      var data = {
        arguments: {ids: null},
        method: command,
      };

      if (hashes.length) {
        data.arguments.ids = hashes;
      }

      if (mutator) {
        data.arguments[mutator] = value;
      }

      return $http.post(this.url(), data, {
        headers: {
          Authorization: "Basic " + config.encoded,
          "X-Transmission-Session-Id": config.session,
        },
      });
    };

    this.doGlobalAction = function (command) {
      return this.doAction(command, []);
    };

    /**
     * Example action function. You will have to implement several of these to support the various
     * actions in your bittorrent client. Each action is supplied an array of the hashes on which
     * the action should be applied.
     * @param {array} hashes
     * @return {promise} actionIsDone
     */
    this.start = function (torrents) {
      return this.doAction("torrent-start", torrents);
    };

    this.stop = function (torrents) {
      return this.doAction("torrent-stop", torrents);
    };

    this.verify = function (torrents) {
      return this.doAction("torrent-verify", torrents);
    };

    this.pauseAll = function () {
      return this.doGlobalAction("torrent-stop");
    };

    this.resumeAll = function () {
      return this.doGlobalAction("torrent-start");
    };

    this.queueUp = function (torrents) {
      return this.doAction("queue-move-up", torrents);
    };

    this.queueDown = function (torrents) {
      return this.doAction("queue-move-down", torrents);
    };

    this.remove = function (torrents) {
      return this.doAction("torrent-remove", torrents);
    };

    this.removeAndLocal = function (torrents) {
      return this.doAction("torrent-remove", torrents, "delete-local-data", true);
    };

    /**
     * Whether the client supports sorting by trackers or not
     */
    this.enableTrackerFilter = true;

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
        click: this.start,
        icon: "play",
        role: "resume",
      },
      {
        label: "Stop",
        type: "button",
        color: "red",
        click: this.stop,
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
    ];

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
        label: "Start",
        click: this.start,
        icon: "play",
      },
      {
        label: "Pause",
        click: this.stop,
        icon: "pause",
      },
      {
        label: "Verify",
        click: this.verify,
        icon: "checkmark",
      },
      {
        label: "Move Up Queue",
        click: this.queueUp,
        icon: "arrow up",
      },
      {
        label: "Move Queue Down",
        click: this.queueDown,
        icon: "arrow down",
      },
      {
        label: "Remove",
        menu: [
          {
            label: "Torrent",
            icon: "remove",
            click: this.remove,
          },
          {
            label: "Torrent and Local Data",
            icon: "remove",
            click: this.removeAndLocal,
            role: "delete",
          },
        ],
      },
    ];
  },
]);
