export interface ParsedServerAddressInput {
    hostname: string
    protocol?: string
    port?: number
    hasExplicitProtocol: boolean
    hasExplicitPort: boolean
}

export interface SanitizableServerAddress {
    ip: string
    proto: string
    port: number
}

const SUPPORTED_PROTOCOLS = new Set(["http", "https"])

export function parseServerAddressInput(input: unknown, fallbackProtocol = "http"): ParsedServerAddressInput {
    const address = String(input || "").trim()
    const baseProtocol = String(fallbackProtocol || "http").replace(/:$/, "")
    const protocolMatch = address.match(/^([a-z][a-z\d+.-]*):\/\//i)

    try {
        const parsed = new URL(protocolMatch ? address : `${baseProtocol}://${address}`)
        const parsedProtocol = parsed.protocol.replace(/:$/, "").toLowerCase()
        const protocol = protocolMatch && SUPPORTED_PROTOCOLS.has(parsedProtocol) ? parsedProtocol : undefined

        return {
            hostname: parsed.hostname.replace(/^\[|\]$/g, ""),
            protocol,
            port: parsed.port ? Number(parsed.port) : undefined,
            hasExplicitProtocol: !!protocol,
            hasExplicitPort: !!parsed.port,
        }
    } catch (_err) {
        return {
            hostname: protocolMatch ? address.replace(protocolMatch[0], "") : address.replace(/^\[|\]$/g, ""),
            protocol: undefined,
            port: undefined,
            hasExplicitProtocol: false,
            hasExplicitPort: false,
        }
    }
}

export function sanitizeServerAddress<T extends SanitizableServerAddress>(server: T): T {
    const parsed = parseServerAddressInput(server.ip, server.proto)

    return {
        ...server,
        ip: parsed.hostname,
        proto: parsed.protocol || server.proto,
        port: parsed.port || server.port,
    }
}
