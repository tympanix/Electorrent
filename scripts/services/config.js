'use strict';

angular.module('torrentApp').service('configService', ['electron', '$q', function(electron, $q) {

    function put(value, key){
        var q = $q.defer();

        electron.config.put(value, key, function(err){
            if (err) q.reject(err)
            else q.resolve();
        })

        return q.promise;
    }

    function get(value){
        var q = $q.defer();

        electron.config.get(value, function(err, data){
            if (err) q.reject(err)
            else q.resolve(data)
        })

        return q.promise;
    }

    this.saveServer = function(ip, port, user, password){
        return put('server', {
            ip: ip,
            port: port,
            user: user,
            password: password
        })
    }

    this.getServer = function() {
        return get('server');
    }

}]);
