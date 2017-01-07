'use strict';

angular.module('torrentApp').factory('Server', function() {

    /**
     * Constructor, with class name
     */
    function Server(ip, port, user, password, client) {
        this.id = generateGUID()
        this.ip = ip
        this.port = port
        this.user = user
        this.password = password
        this.client = client
    }

    Server.prototype.json = function () {
        return {
            id: this.id,
            ip: this.ip,
            port: this.port,
            user: this.user,
            password: this.password,
            client: this.client
        }
    };

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
});