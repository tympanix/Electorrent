const fs = require('fs')
const path = require('path')
const $q = require('q')

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

    _define(func) {
        if (this[func]) {
            throw new Error("Duplicate method definition")
        }

        this[func] = function() {
            var defer = $q.defer()

            var id = _ID++
            this._callbacks[id] = function(error, data) {
                if (error) {
                    defer.reject(new Error(error))
                } else {
                    defer.resolve(data)
                }
            }

            this._worker.postMessage([id, func, ...arguments])

            return defer.promise
        }
    }
}

class InstanceWorker {

    constructor(factory, worker) {
        this._worker = worker
        this._factory = factory
        this._instance = null
        this._worker.onmessage = this._onMessage.bind(this)
        this._callback = this._callback.bind(this)
    }

    _callback(id) {
        return function(error, value) {
            if (error) {
                this._worker.postMessage([id, error.toString(), null])
            } else {
                this._worker.postMessage([id, null, value])
            }
        }.bind(this)
    }

    instantiate() {
        this._instance = new this._factory(...arguments)
        let cb = arguments[arguments.length - 1]
        cb(null, true)
    }

    _onMessage(msg) {
        var data = msg.data

        if (data.constructor !== Array) {
            return self.postMessage([-1, "Invalid RPC call", null])
        }

        var id = data[0]
        var call = data[1]
        var args = data.slice(2)

        let fn = null
        let target = null
        if (this[call] && typeof this[call] === 'function') {
            fn = this[call]
            target = this
        } else if (this._worker.hasOwnProperty(call) && typeof this._worker[call] === 'function') {
            fn = this._worker[call]
            target = this._worker
        } else if (this._instance && typeof this._instance[call] === 'function') {
            fn = this._instance[call]
            target = this._instance
        } else {
            this._worker.postMessage([id, `${call} is not a function`, null])
        }

        if (fn) {
            fn.apply(target, [...args, this._callback(id)])
        }
    }
}


module.exports = {
    Remote,
    InstanceWorker,
}
