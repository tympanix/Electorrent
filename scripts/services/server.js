'use strict';

angular.module('torrentApp').factory('Server', ['AbstractTorrent', '$btclients', function(Torrent, $btclients) {

    /**
     * Constructor, with class name
     */
    function Server(ip, port, user, password, client) {
        if (arguments.length === 1) {
            this.fromJson(arguments[0])
        } else {
            this.id = generateGUID()
            this.ip = ip
            this.port = port
            this.user = user
            this.password = password
            this.client = client
            this.lastused = -1
            this.columns = defaultColumns()
        }
    }

    Server.prototype.fromJson = function (data) {
        this.id = data.id
        this.ip = data.ip
        this.port = data.port
        this.user = data.user
        this.password = data.password
        this.client = data.client
        this.default = data.default
        this.lastused = data.lastused
        this.columns = parseColumns(data.columns)
    };

    Server.prototype.json = function () {
        return {
            id: this.id,
            ip: this.ip,
            port: this.port,
            user: this.user,
            password: this.password,
            client: this.client,
            default: this.default,
            lastused: this.lastused || -1,
            columns: this.columns.filter((column) => column.enabled).map((column) => column.name)
        }
    };

    Server.prototype.getName = function () {
        return $btclients[this.client].name
    };

    Server.prototype.getIcon = function () {
        return $btclients[this.client].icon
    };

    Server.prototype.getNameAtAddress = function () {
        return this.getName() + " @ " + this.ip
    };

    Server.prototype.updateLastUsed = function () {
        this.lastused = new Date().getTime()
    };

    function parseColumns(data) {
        if (!data || data.length === 0) return defaultColumns()
        data.map((entry) => {
            let column = Torrent.COLUMNS.find((column) => column.name === entry)
            angular.copy(column, column)
            column.enabled = true
            return column
        })
    }

    function defaultColumns() {
        let columns = []
        angular.copy(Torrent.COLUMNS, columns)
        columns.forEach((columns) => columns.enabled = true)
        return columns
    }

    function generateGUID() {
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    }

    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }

    /**
     * Return the constructor function
     */
    return Server;
}]);