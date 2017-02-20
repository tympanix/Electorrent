'use strict';

angular.module('torrentApp').factory('Server', ['AbstractTorrent', '$q', 'notificationService', '$bittorrent', '$btclients', function(Torrent, $q, $notify, $bittorrent, $btclients) {

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
        this.isConnected = false
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

    Server.prototype.connect = function () {
        let self = this

        if (!this.client) {
            $notify.alert("Opps!", "Please select a client to connect to!")
            return $q.reject()
        }

        this.service = $bittorrent.getClient(this.client);
        return this.service.connect(this.ip, this.port, this.user, this.password).catch(function(response, msg) {
            self.isConnected = false
            $notify.alertAuth(response, msg);
            return $q.reject(response, this)
        }).then(function() {
            self.isConnected = true
            //$bittorrent.setClient(self.service);
            $bittorrent.setServer(self)
            return $q.resolve()
        })
    };

    Server.prototype.equals = function(other) {
        return (
            this.ip === other.ip &&
            this.port === other.port &&
            this.user === other.user &&
            this.password === other.password &&
            this.client === other.client
        )
    }

    function zipsort(obj, sor) {
        return function(a,b) {
            let i = sor.indexOf(a.name)
            let j = sor.indexOf(b.name)
            if (i === j) {
                return 0
            } else if (i === -1) {
                return 1
            } else if (j === -1) {
                return -1
            } else {
                return i - j
            }
        }
    }

    function parseColumns(data) {
        if (!data || data.length === 0) return defaultColumns()
        let columns = []
        angular.copy(Torrent.COLUMNS, columns)
        columns.sort(zipsort(columns, data))
        columns.forEach((column) => {
            column.enabled = data.some((entry) => (entry === column.name))
        })
        return columns
    }

    function defaultColumns() {
        let columns = []
        angular.copy(Torrent.COLUMNS, columns)
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