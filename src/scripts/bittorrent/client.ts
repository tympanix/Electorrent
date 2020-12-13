import angular from "angular"
import _ from "underscore"

angular.module('torrentApp').factory('Client', ['AbstractTorrent', 'Column', function(Torrent, Column) {

    function Client() {
        this.availableColumns = _.difference(Torrent.COLUMNS, this.disabledColumns)
    }

    Client.prototype.connect = function (ip, port, user, pass) {
        throw new Error("Not implemented")
    };

    Client.prototype.torrents = function () {
        throw new Error("Not implemented")
    };

    Client.prototype.addTorrentUrl = function () {
        throw new Error("Not implemented")
    };

    Client.prototype.uploadTorrent = function () {
        throw new Error("Not implemented")
    };

    Client.prototype.setLabel = function (torrent, label) {
        throw new Error("Not implemented")
    };

    Client.prototype.disabledColumns = []

    Client.prototype.actionHeader = []

    Client.prototype.contextMenu = []

    /**
     * Return the constructor function
     */
    return Client;
}]);