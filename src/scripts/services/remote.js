'use strict';

angular.module('torrentApp').factory('$remote', ['$q', function($q) {

    let _ID = 0

    class Remote {

        constructor(prototype, worker) {
            this._self = this
            this._prototype = prototype
            this._worker = worker
            this._worker.onmessage = this._eventListener.bind(this)
            this._callbacks = {}

            for (var fn in this._prototype) {
                if (typeof this._prototype[fn] === 'function') {
                    this._define(fn)
                }
            }

            this._define('instantiate')
        }

        _eventListener(msg) {
            var data = msg.data

            if (data.length !== 3) {
                return console.error("Invalid response from rtorrent worker")
            }

            var id = data[0]
            var error = data[1]
            var value = data[2]

            if (!this._callbacks[id]) {
                return console.error("No callback found for worker")
            }

            this._callbacks[id](error, value)
            delete this._callbacks[id]
        }

        _error(errObj) {
            let msg = errObj.message && errObj.message.replace(/^Error: /, "")
            let err = new Error(msg || 'An unknown worker error occured')
            for (let k of Object.getOwnPropertyNames(errObj)) {
                err[k] = errObj[k]
            }
            return err
        }

        _define(func) {
            let self = this
            if (this[func]) {
                throw new Error("Duplicate method definition")
            }

            this[func] = function() {
                var defer = $q.defer()

                var id = _ID++
                this._callbacks[id] = function(err, data) {
                    if (err) {
                        defer.reject(self._error(err))
                    } else {
                        defer.resolve(data)
                    }
                }

                this._worker.postMessage([id, func, ...arguments])

                return defer.promise
            }
        }
    }

    return Remote
}]);