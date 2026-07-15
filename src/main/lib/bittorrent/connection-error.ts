import type { BittorrentConnectionError, BittorrentConnectionErrorKind } from "@shared/ipc-contract"

const TLS_CODES = new Set([
    "DEPTH_ZERO_SELF_SIGNED_CERT",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "CERT_HAS_EXPIRED",
    "ERR_TLS_CERT_ALTNAME_INVALID",
])

const TIMEOUT_CODES = new Set(["ECONNABORTED", "ESOCKETTIMEDOUT", "ETIMEDOUT"])
const ADDRESS_CODES = new Set(["EAI_AGAIN", "ENOTFOUND"])
const UNREACHABLE_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH"])

const MESSAGES: Record<BittorrentConnectionErrorKind, string> = {
    authentication: "Incorrect username or password.",
    timeout: "Connection timed out.",
    unreachable: "Client is unreachable.",
    address: "Check the client address and path.",
    tls: "Secure connection failed.",
    server: "Client is unavailable.",
    response: "Client returned an invalid response.",
    cancelled: "Connection cancelled.",
    unknown: "Could not connect to client.",
}

type ErrorDetails = {
    codes: Set<string>
    statuses: Set<number>
    messages: string[]
}

function collectErrorDetails(error: unknown, details: ErrorDetails, seen: Set<unknown>) {
    if (error === null || error === undefined || seen.has(error)) {
        return
    }
    if (typeof error !== "object") {
        details.messages.push(String(error))
        return
    }

    seen.add(error)
    const value = error as Record<string, any>
    if (typeof value.code === "string") {
        details.codes.add(value.code.toUpperCase())
    }
    for (const status of [value.status, value.statusCode, value.response?.status]) {
        const numericStatus = Number(status)
        if (Number.isInteger(numericStatus)) {
            details.statuses.add(numericStatus)
        }
    }
    if (value.message) {
        details.messages.push(String(value.message))
    }
    if (Array.isArray(value.errors)) {
        value.errors.forEach((nestedError) => collectErrorDetails(nestedError, details, seen))
    }
    collectErrorDetails(value.cause, details, seen)
}

function connectionError(kind: BittorrentConnectionErrorKind, details: ErrorDetails): BittorrentConnectionError {
    return {
        kind,
        message: MESSAGES[kind],
        code: [...details.codes][0],
    }
}

export function normalizeConnectionError(error: unknown): BittorrentConnectionError {
    const details: ErrorDetails = { codes: new Set(), statuses: new Set(), messages: [] }
    collectErrorDetails(error, details, new Set())
    const message = details.messages.join(" ").toLowerCase()

    if (message.includes("stale bittorrent connection")) {
        return connectionError("cancelled", details)
    }
    if ([...details.codes].some((code) => TLS_CODES.has(code))
        || /self[- ]signed certificate|certificate (has expired|is not yet valid)|unable to verify.*certificate|hostname.*certificate/.test(message)) {
        return connectionError("tls", details)
    }
    if ([...details.statuses].some((status) => status === 401 || status === 403)
        || /\b(401|403)\b|invalid (login|credentials)|failed to authenticate|incorrect password|no such account|account disabled|permission denied/.test(message)) {
        return connectionError("authentication", details)
    }
    if ([...details.codes].some((code) => TIMEOUT_CODES.has(code)) || /timed? ?out|timeout/.test(message)) {
        return connectionError("timeout", details)
    }
    if ([...details.codes].some((code) => ADDRESS_CODES.has(code))) {
        return connectionError("address", details)
    }
    if ([...details.codes].some((code) => UNREACHABLE_CODES.has(code))) {
        return connectionError("unreachable", details)
    }
    if (details.statuses.has(404) || /\b404\b/.test(message)) {
        return connectionError("address", details)
    }
    if ([...details.statuses].some((status) => status >= 500)) {
        return connectionError("server", details)
    }
    if (/did not return|invalid response|unexpected token|parse error/.test(message)) {
        return connectionError("response", details)
    }

    return connectionError("unknown", details)
}
