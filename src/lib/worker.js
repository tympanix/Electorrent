const fs = require('fs')
const path = require('path')
const $q = require('q')

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
    InstanceWorker,
}
