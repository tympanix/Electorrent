const Rtorrent = require('node-rtorrent')

let client = null

function callback(id) {
    return function(error, value) {
        if (error) {
            self.postMessage([id, error.toString(), null])
        } else {
            self.postMessage([id, null, value])
        }
    }
}

self.newClient = function(config, cb) {
    client = new Rtorrent(config)
    console.log("NewClient", arguments)
    cb(null, "ok")
}

self.onmessage = function(msg) {
    var data = msg.data

    console.log("Worker:", data)

    if (data.constructor !== Array) {
        return self.postMessage([-1, "Invalid RPC call", null])
    }

    var id = data[0]
    var call = data[1]
    var args = data.slice(2)

    console.log("Worker id", id)
    console.log("Worker call", call)
    console.log("Worker args", args)

    if (self.hasOwnProperty(call) && typeof self[call] === 'function') {
        self[call](...args, callback(id))
    } else if (client && typeof client[call] === 'function') {
        client[call](...args, callback(id))
    } else {
        self.postMessage([id, `${call} is not a function`, null])
    }
}
