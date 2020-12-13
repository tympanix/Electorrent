"use strict";

angular.module("torrentApp").service("utorrentService", [
  "$http",
  "$resource",
  "$log",
  "$q",
  "TorrentU",
  "notificationService",
  "Column",
  function ($http, $resource, $log, $q, Torrent, $notify, Column) {
    this.server = undefined;
    this.name = "µTorrent";

    var data = {
      url: null,
      username: null,
      password: null,
      token: null,
      cid: 0,
      build: -1,
    };

    function build(array) {
      var torrent = Object.create(Torrent.prototype);
      torrent = Torrent.apply(torrent, array) || torrent;
      return torrent;
    }

    var updateCidInterceptor = {
      response: function (response) {
        data.cid = response.data.torrentc;
      },
      responseError: function (response) {
        console.error("error in interceptor", data, arguments, response);
      },
    };

    function extractTokenFromHTML(str) {
      var match = str.match(/>([^<]+)</);
      if (match) {
        data.token = match[match.length - 1];
        return true;
      }
      return false;
    }

    function handleError(value) {
      let json = null;
      if (typeof value === "object") {
        json = value;
      } else {
        try {
          json = JSON.parse(value);
        } catch {
          return;
        }
      }
      if (json.error !== null && json.error !== undefined) {
        throw new Error(json.error);
      }
      if (typeof json.data === "object") {
        handleError(json.data);
      }
    }

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

    this.url = function (path) {
      return `${this.server.url()}${path || ""}`;
    };

    this.saveConnection = function (url, username, password) {
      data.username = username;
      data.password = password;
      data.url = url;
    };

    /**
         * Returns the default path for the service. Should start with a slash.
         @return {string} the default path
         */
    this.defaultPath = function () {
      return "/gui";
    };

    this.connect = function (server) {
      var loading = $q.defer();
      this.server = server;
      let self = this;

      var encoded = new Buffer(`${server.user}:${server.password}`).toString("base64");
      $http.defaults.headers.common.Authorization = "Basic " + encoded;

      $http
        .get(this.url() + "/token.html?t=" + Date.now(), {
          timeout: 5000,
        })
        .success(function (str) {
          if (extractTokenFromHTML(str)) {
            self.saveConnection(server.url(), server.user, server.password);
            loading.resolve(data.token);
          } else {
            loading.reject("Could not find token");
          }
        })
        .catch(function (err) {
          loading.reject(err);
        });

      return loading.promise;
    };

    this.addTorrentUrl = function (url, dir, path) {
      return $resource(data.url + "/." + "?token=:token&action=add-url&s=:url&download_dir=:dir&path=:path&t=:t", {
        token: data.token,
        t: Date.now(),
        url: url,
        dir: dir,
        path: path,
      }).get().$promise;
    };

    this.uploadTorrent = function (buffer, filename, dir, path) {
      let array = bufferToUnit8Array(Buffer.from(buffer));
      var blob = new Blob([array], { type: "application/x-bittorrent" });

      var formData = new FormData();
      formData.append("torrent_file", blob, filename);

      return $http
        .post(data.url + "/.", formData, {
          params: {
            token: data.token,
            action: "add-file",
            download_dir: dir || 0,
            path: path,
          },
          headers: { "Content-Type": undefined },
          transformRequest: function (data) {
            return data;
          },
        })
        .then(handleError);
    };

    this.torrents = function () {
      var ret = $q.defer();
      var torrents = {
        labels: [],
        all: [],
        changed: [],
        deleted: [],
      };
      var utorrentRes = _torrents().list(
        function () {
          torrents.labels = (utorrentRes.label || []).map(labelTransform);
          torrents.all = (utorrentRes.torrents || []).map(build);
          torrents.changed = (utorrentRes.torrentp || []).map(build);
          torrents.deleted = utorrentRes.torrentm;
          ret.resolve(torrents);
        },
        function (err) {
          ret.reject(err);
        }
      );

      return ret.promise;
    };

    function labelTransform(label) {
      return label[0];
    }

    function _torrents() {
      return $resource(
        data.url + "/." + "?:action:data&token=:token&cid=:cid:opt&t=:t",
        {
          token: data.token,
          cid: data.cid,
          t: Date.now(),
        },
        {
          list: {
            method: "GET",
            params: {
              action: "list=1",
            },
            transformResponse: function (response) {
              return angular.fromJson(response.replace(/[\x00-\x1F]/g, ""));
            },
            interceptor: updateCidInterceptor,
            isArray: false,
          },
        }
      );
    }

    function doAction(action, torrents) {
      var hashes = torrents.map(function (torrent) {
        return torrent.hash;
      });

      return $resource(data.url + "/." + "?action=:action&token=:token&t=:t", {
        action: action,
        hash: hashes,
        token: data.token,
        cid: data.cid,
        t: Date.now(),
      }).get().$promise;
    }

    this.start = function (torrents) {
      return doAction("start", torrents);
    };

    this.stop = function (torrents) {
      return doAction("stop", torrents);
    };

    this.pause = function (torrents) {
      return doAction("pause", torrents);
    };

    this.remove = function (torrents) {
      return doAction("remove", torrents);
    };

    this.removedata = function (torrents) {
      return doAction("removedata", torrents);
    };

    this.removetorrent = function (torrents) {
      return doAction("removetorrent", torrents);
    };

    this.removedatatorrent = function (torrents) {
      return doAction("removedatatorrent", torrents);
    };

    this.forcestart = function (torrents) {
      return doAction("forcestart", torrents);
    };

    this.recheck = function (torrents) {
      return doAction("recheck", torrents);
    };

    this.queueup = function (torrents) {
      return doAction("queueup", torrents);
    };

    this.queuedown = function (torrents) {
      return doAction("queuedown", torrents);
    };

    this.getprops = function (torrents) {
      return doAction("getprops", torrents);
    };

    this.getFileDownloadUrl = function (torrent, file) {
      if (torrent.streamId && this.settingsMap["webui.uconnect_enable"] && file.size === file.sizeDownloaded) {
        return (
          "/proxy?sid=" + torrent.streamId + "&file=" + file.hash + "&disposition=ATTACHMENT&service=DOWNLOAD&qos=0"
        );
      }
      return undefined;
    };

    this.setLabel = function (torrents, label) {
      var hashes = torrents.map(function (torrent) {
        return torrent.hash;
      });

      var encodedQuery = "";
      var i;
      for (i = 0; i < hashes.length; i++) {
        encodedQuery += "&" + ["hash=" + hashes[i], "s=label", "v=" + encodeURIComponent(label)].join("&");
      }
      return $http.get(data.url + "/." + "?token=" + data.token + "&action=setprops" + encodedQuery, {
        params: {
          t: Date.now(),
        },
      });
    };

    this.getSettings = function () {
      return this.actions()._getsettings().$promise;
    };

    this.setSetting = function (setting, value) {
      return this.setSettings([[setting, value]]);
    };

    this.setSettings = function (settings) {
      // [ [setting1,value1], [setting2,value2] ]
      var encodedQuery = "";
      var i, val;
      for (i = 0; i < settings.length; i++) {
        val = settings[i][1];
        if (val === "true") {
          val = "1";
        } else if (val === "false") {
          val = "0";
        }
        encodedQuery += "&" + ["s=" + settings[i][0], "v=" + encodeURIComponent(val)].join("&");
      }
      return $http.get(data.url + "?token=" + data.token + "&action=setsetting" + encodedQuery, {
        params: {
          t: Date.now(),
        },
      });
    };

    this.getDownloadDirectories = function () {
      return $resource(
        data.url + "/." + "?token=:token&action=list-dirs&t=:t",
        {
          token: data.token,
          t: Date.now(),
        },
        {
          get: {
            isArray: true,
            transformResponse: function (response) {
              var responseData = angular.fromJson(response);
              return responseData["download-dirs"];
            },
          },
        }
      ).get().$promise;
    };

    this.filePriority = function () {
      return $resource(
        data.url + "/." + "?token=:token&action=setprio&hash=:hash&t=:t&p=:priority",
        {
          token: data.token,
          t: Date.now(),
        },
        {
          set: {
            method: "GET",
          },
        }
      );
    };

    this.getVersion = function () {
      var buildVersionStr = function () {
        var prefix = "μTorrent";
        var preBuild = "build";
        return [prefix, preBuild, data.build].join(" ");
      };

      if (data.build === -1) {
        return "";
      }
      return buildVersionStr();
    };

    this.columns = [
      new Column("Name", "text", "decodedName"),
      new Column("Size", "text", "size", "bytes"),
      new Column("Down", "text", "downloadSpeed", "speed"),
      new Column("Progress", "progress"),
      new Column("Label", "text", "label"),
      new Column("Date Added", "text", "dateAdded", "date"),
    ];

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
        label: "Pause",
        type: "button",
        color: "yellow",
        click: this.pause,
        icon: "pause",
      },
      {
        label: "Stop",
        type: "button",
        color: "red",
        click: this.stop,
        icon: "stop",
        role: "stop",
      },
      {
        label: "Labels",
        click: this.setLabel,
        type: "labels",
      },
    ];

    this.contextMenu = [
      {
        label: "Recheck",
        click: this.recheck,
        icon: "checkmark",
      },
      {
        label: "Force Start",
        click: this.forcestart,
        icon: "flag",
      },
      {
        label: "Move Up Queue",
        click: this.queueup,
        icon: "arrow up",
      },
      {
        label: "Move Queue Down",
        click: this.queuedown,
        icon: "arrow down",
      },
      {
        label: "Remove",
        click: this.remove,
        icon: "remove",
        role: "delete",
      },
      {
        label: "Remove And",
        menu: [
          {
            label: "Delete Torrent",
            click: this.removetorrent,
          },
          {
            label: "Delete Data",
            click: this.removedata,
          },
          {
            label: "Delete All",
            click: this.removedatatorrent,
          },
        ],
      },
    ];
  },
]);
