'use strict';

angular.module('torrentApp').service('rtorrentRpc', ['$q', function($q) {

    let _ID = 0
    let _self = this
    let _worker = new Worker('scripts/workers/rtorrent.js')
    let _callbacks = {}

    _worker.addEventListener('message', function(msg) {
        var data = msg.data

        console.log("Worker response:", data)

        if (data.length !== 3) {
            return console.error("Invalid response from rtorrent worker")
        }

        var id = data[0]
        var error = data[1]
        var value = data[2]

        if (!_callbacks[id]) {
            return console.error("No callback found for worker")
        }

        _callbacks[id](error, value)
        delete _callbacks[id]
    })

    function define(func) {
        _self[func] = function() {
            var defer = $q.defer()

            var id = _ID++
            _callbacks[id] = function(error, data) {
                if (error) {
                    defer.reject(new Error(error))
                } else {
                    defer.resolve(data)
                }
            }

            _worker.postMessage([id, func, ...arguments])

            return defer.promise
        }
    }

    const METHODS = [
        'instantiate',
        'get',
        'getXmlrpc',
        'getMulticall',
        'getAll',
        'getTorrents',
        'getTorrentTrackers',
        'getTorrentFiles',
        'getTorrentPeers',
        'systemMulticall',
        'getGlobals',
        'start',
        'stop',
        'remove',
        'loadLink',
        'loadFile',
        'loadFileContent',
        'setPath',
    ]

    METHODS.map(define)

}]);
