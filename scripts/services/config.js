'use strict';

angular.module('torrentApp').service('configService', ['electron', '$q', function(electron, $q) {

    const config = electron.config;

    // Angular wrapper for saving to config
    function put(key, value){
        var q = $q.defer();
        config.put(key, value, function(err){
            if (err) q.reject(err)
            else q.resolve();
        });
        return q.promise;
    }

    // Angular wrapper for getting config
    function get(value){
        return config.get(value);
    }

    this.saveServer = function(ip, port, user, password){
        if (arguments.length === 1){
            return put('server', arguments[0]);
        } else {
            return put('server', {
                ip: ip,
                port: port,
                user: user,
                password: password
            })
        }
    }

    this.getServer = function() {
        return get('server');
    }

}]);
