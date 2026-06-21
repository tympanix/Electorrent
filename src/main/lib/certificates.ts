import { app, type Certificate } from 'electron'
import fs from 'fs'
import https from 'https'
import path from 'path'

import type { CertificatePrompt } from '@shared/ipc-contract'
import { sanitizeServerAddress } from '@shared/server-address'

const CERT_DIR = path.join(app.getPath('userData'), 'certs')
const FINGERPRINT_PATTERN = /^(?:[A-Fa-f0-9]{2}:?)+$/

function ensureDir() {
    try {
        fs.mkdirSync(CERT_DIR, { recursive: true })
    } catch (e) {
        console.error(e)
    }
}

ensureDir()

function isEmpty(object: Record<string, unknown>) {
    for (const prop in object) {
        if (Object.prototype.hasOwnProperty.call(object, prop)) {
            return false
        }
    }

    return true
}

function pemEncode(input: Buffer | Uint8Array | string, n: number) {
    let value = input
    if (!Buffer.isBuffer(value)) {
        value = Buffer.from(value)
    }
    const encoded = value.toString('base64')

    const ret: string[] = []

    for (let i = 1; i <= encoded.length; i++) {
        ret.push(encoded[i - 1])
        const mod = i % n

        if (mod === 0) {
            ret.push('\n')
        }
    }

    return `-----BEGIN CERTIFICATE-----\n${ret.join('')}\n-----END CERTIFICATE-----`
}

function normalizeFingerprint(fingerprint: string) {
    if (typeof fingerprint !== 'string' || !FINGERPRINT_PATTERN.test(fingerprint)) {
        throw new Error('Invalid certificate fingerprint')
    }

    const normalized = fingerprint.replace(/:/g, '').toLowerCase()

    if (normalized.length === 0 || normalized.length % 2 !== 0) {
        throw new Error('Invalid certificate fingerprint')
    }

    return normalized
}

function getCertificatePath(fingerprint: string) {
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

export function get(server: { ip: string; port: number; path: string; id: string }, callback: (err: Error | null, cert?: unknown) => void) {
    const sanitizedServer = sanitizeServerAddress({ ...server, proto: 'https' })
    const options = {
        hostname: sanitizedServer.ip,
        port: server.port,
        path: server.path,
        agent: false,
        rejectUnauthorized: false,
        ciphers: 'ALL',
    }

    const req = https.get(options, function(res: any) {
        const certificate = res.socket.getPeerCertificate()
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

    req.on('error', function(e: Error) {
        callback(e)
    })

    req.end()
}

export function installCertificate(cert: { raw?: Uint8Array; fingerprint: string }, callback: (err: Error | null, fingerprint?: string) => void) {
    if (!cert.raw) {
        return callback(new Error('Could not install invalid certificate'))
    }

    try {
        ensureDir()
        const pemData = pemEncode(cert.raw, 64)
        const { certPath, fingerprint } = getCertificatePath(cert.fingerprint)

        fs.writeFile(certPath, pemData, (err: Error | null) => callback(err, fingerprint))
    } catch (err) {
        callback(err as Error)
    }
}

export function loadCertificate(fingerprint: string) {
    const { certPath } = getCertificatePath(fingerprint)
    if (!fs.existsSync(certPath)) {
        return
    }

    try {
        return fs.readFileSync(certPath)
    } catch (_e) {
        return
    }
}

export function sanitizeCertificateError(certificate: Certificate): CertificatePrompt {
    return {
        source: 'main-certificate-error',
        selfSigned: !certificate.issuerCert,
        issuer: {
            country: certificate.issuer && certificate.issuer.country,
            state: certificate.issuer && certificate.issuer.state,
            organization: certificate.issuer && certificate.issuer.organizations && certificate.issuer.organizations[0],
            organizationUnit: certificate.issuer && certificate.issuer.organizationUnits && certificate.issuer.organizationUnits[0],
            commonName: certificate.issuer && certificate.issuer.commonName,
        },
        subject: {
            country: certificate.subject && certificate.subject.country,
            state: certificate.subject && certificate.subject.state,
            organization: certificate.subject && certificate.subject.organizations && certificate.subject.organizations[0],
            organizationUnit: certificate.subject && certificate.subject.organizationUnits && certificate.subject.organizationUnits[0],
            commonName: certificate.subject && certificate.subject.commonName,
        },
        fingerprint: certificate.fingerprint,
        validFrom: certificate.validStart,
        validTo: certificate.validExpiry,
        serialNumber: certificate.serialNumber,
    }
}
