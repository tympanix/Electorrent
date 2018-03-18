const https = require('https')
const fs = require('fs')
const path = require('path')
const { app } = require('electron')

const config = require('./config')
const electorrent = require('./electorrent')

const CERT_DIR = path.join(app.getPath('userData'), 'certs')

function ensureDir() {
    try {
        if (!fs.existsSync(CERT_DIR)) {
            fs.mkdirSync(CERT_DIR)
        }
    } catch (e) {
        console.error(err)
    }
}

/*
 * Make sure the certificate directory exists
 */
ensureDir()

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
            torrentWindow.webContents.send('certificate-modal-node', certificate, server);
            callback(null, certificate)
        }
    })

    req.on('error', function(e) {
        callback(e)
    })

    req.end()
}

function installCertificate(cert, callback) {
    if (!cert.raw) {
        return callback(new Error('Could not install invalid certificate'))
    }

    const pemData = pemEncode(cert.raw.toString('base64'), 64)
    const fingerprint = cert.fingerprint.split(":").join("").toLowerCase()

    const pemFilename = path.join(CERT_DIR, `${fingerprint}.crt`)
    fs.writeFile(pemFilename, pemData, (err) => callback(err, fingerprint))
}

function loadCertificate(fingerprint) {
    const certPath = path.join(CERT_DIR, `${fingerprint}.crt`)
    if (!fs.existsSync(certPath)) {
        return
    }
    try {
        return fs.readFileSync(certPath)
    } catch (e) {
        return
    }
}

module.exports = {
    get: get,
    installCertificate: installCertificate,
    loadCertificate: loadCertificate,
}