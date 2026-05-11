const https = require('https')
const fs = require('fs')
const path = require('path')
const { app } = require('electron')

const CERT_DIR = path.join(app.getPath('userData'), 'certs')
const FINGERPRINT_PATTERN = /^(?:[A-Fa-f0-9]{2}:?)+$/

function ensureDir() {
    try {
        if (!fs.existsSync(CERT_DIR)) {
            fs.mkdirSync(CERT_DIR)
        }
    } catch (e) {
        console.error(e)
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
    if (!Buffer.isBuffer(str)) {
        str = Buffer.from(str)
    }
    str = str.toString("base64")

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

function normalizeFingerprint(fingerprint) {
    if (typeof fingerprint !== 'string' || !FINGERPRINT_PATTERN.test(fingerprint)) {
        throw new Error('Invalid certificate fingerprint')
    }

    const normalized = fingerprint.replace(/:/g, '').toLowerCase()

    if (normalized.length === 0 || normalized.length % 2 !== 0) {
        throw new Error('Invalid certificate fingerprint')
    }

    return normalized
}

function getCertificatePath(fingerprint) {
    const normalizedFingerprint = normalizeFingerprint(fingerprint)
    const certPath = path.resolve(CERT_DIR, `${normalizedFingerprint}.crt`)
    const certDir = `${path.resolve(CERT_DIR)}${path.sep}`

    if (!certPath.startsWith(certDir)) {
        throw new Error('Invalid certificate fingerprint')
    }

    return {
        certPath,
        fingerprint: normalizedFingerprint,
    }
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
            callback(null, {
                source: 'node-client-check',
                serverId: server.id,
                selfSigned: !certificate.issuerCertificate,
                issuer: {
                    country: certificate.issuer && certificate.issuer.C,
                    state: certificate.issuer && certificate.issuer.ST,
                    organization: certificate.issuer && certificate.issuer.O,
                    organizationUnit: certificate.issuer && certificate.issuer.OU,
                    commonName: certificate.issuer && certificate.issuer.CN,
                },
                subject: {
                    country: certificate.subject && certificate.subject.C,
                    state: certificate.subject && certificate.subject.ST,
                    organization: certificate.subject && certificate.subject.O,
                    organizationUnit: certificate.subject && certificate.subject.OU,
                    commonName: certificate.subject && certificate.subject.CN,
                },
                fingerprint: certificate.fingerprint,
                validFrom: new Date(certificate.valid_from).getTime() / 1000,
                validTo: new Date(certificate.valid_to).getTime() / 1000,
                serialNumber: certificate.serialNumber,
                raw: certificate.raw ? new Uint8Array(certificate.raw) : undefined,
            })
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

    try {
        const pemData = pemEncode(cert.raw, 64)
        const { certPath, fingerprint } = getCertificatePath(cert.fingerprint)

        fs.writeFile(certPath, pemData, (err) => callback(err, fingerprint))
    } catch (err) {
        callback(err)
    }
}

function loadCertificate(fingerprint) {
    const { certPath } = getCertificatePath(fingerprint)
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
