const config = require('./config')
const electorrent = require('./electorrent')

var https = require('https')

function isEmpty(object) {
    for (var prop in object) {
        if (object.hasOwnProperty(prop))
            return false
    }

    return true
}

function pemEncode(str, n) {
    var ret = []

    for (var i = 1; i <= str.length; i++) {
        ret.push(str[i - 1])
        var mod = i % n

        if (mod === 0) {
            ret.push('\n')
        }
    }

    var returnString = `-----BEGIN CERTIFICATE-----\n${ret.join('')}\n-----END CERTIFICATE-----`

    return returnString
}

function get(server, callback) {
    var options = {
        hostname: server.ip,
        port: server.port,
        path: server.path,
        agent: false,
        rejectUnauthorized: false,
        ciphers: 'ALL'
    }

    var req = https.get(options, function(res) {
        var certificate = res.socket.getPeerCertificate()
        if (isEmpty(certificate) || certificate === null) {
            callback(new Error('The website did not provide a certificate'))
        } else {
            let torrentWindow = electorrent.getWindow()
            torrentWindow.webContents.send('certificate-modal-node', certificate);
            if (certificate.raw) {
                certificate.pemEncoded = pemEncode(certificate.raw.toString('base64'), 64)
            }
            callback(null, certificate)
        }
    })

    req.on('error', function(e) {
        callback(e)
    })

    req.end()
}

module.exports = {
    get: get
}