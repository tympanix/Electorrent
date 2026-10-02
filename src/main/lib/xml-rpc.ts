import http from "node:http"
import https from "node:https"
import { XMLParser, XMLValidator } from "fast-xml-parser"

export type XmlRpcValue = null | boolean | number | bigint | string | Date | Buffer | XmlRpcValue[] | { [key: string]: XmlRpcValue }

export type XmlRpcClientOptions = {
    ca?: string | Buffer
    headers?: Record<string, string>
    rejectUnauthorized?: boolean
    timeout?: number
}

type ParsedXmlRpcValue = string | Record<string, any>

const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    trimValues: false,
    isArray: (_tagName, path) => typeof path === "string" && (path === "methodResponse.params.param" || path.endsWith(".array.data.value") || path.endsWith(".struct.member")),
})

function escapeXml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;")
}

function encodeValue(value: XmlRpcValue): string {
    if (value === null) {
        return "<value><nil/></value>"
    }
    if (Buffer.isBuffer(value)) {
        return `<value><base64>${value.toString("base64")}</base64></value>`
    }
    if (value instanceof Date) {
        return `<value><dateTime.iso8601>${encodeDate(value)}</dateTime.iso8601></value>`
    }
    if (Array.isArray(value)) {
        return `<value><array><data>${value.map(encodeValue).join("")}</data></array></value>`
    }

    switch (typeof value) {
        case "boolean":
            return `<value><boolean>${value ? 1 : 0}</boolean></value>`
        case "bigint":
            return `<value><i8>${value}</i8></value>`
        case "number":
            if (!Number.isFinite(value)) {
                throw new TypeError("XML-RPC numbers must be finite")
            }
            if (!Number.isInteger(value)) {
                return `<value><double>${value}</double></value>`
            }
            if (!Number.isSafeInteger(value)) {
                throw new TypeError("XML-RPC integer numbers must be safe integers; use bigint for larger values")
            }
            return value >= -2_147_483_648 && value <= 2_147_483_647
                ? `<value><int>${value}</int></value>`
                : `<value><i8>${value}</i8></value>`
        case "string":
            return `<value><string>${escapeXml(value)}</string></value>`
        case "object":
            return `<value><struct>${Object.entries(value).map(([name, memberValue]) => `<member><name>${escapeXml(name)}</name>${encodeValue(memberValue)}</member>`).join("")}</struct></value>`
        default:
            throw new TypeError(`Unsupported XML-RPC value: ${typeof value}`)
    }
}

// XML-RPC's compact date has no timezone marker. Encode and decode it as UTC so
// the value stays deterministic across Electorrent hosts in different zones.
function encodeDate(value: Date): string {
    if (Number.isNaN(value.getTime())) {
        throw new TypeError("XML-RPC dates must be valid")
    }

    const pad = (part: number) => String(part).padStart(2, "0")
    return `${value.getUTCFullYear()}${pad(value.getUTCMonth() + 1)}${pad(value.getUTCDate())}T${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`
}

function decodeValue(node: ParsedXmlRpcValue): any {
    if (typeof node === "string") {
        return node
    }
    if ("string" in node) return node.string
    if ("boolean" in node) {
        if (node.boolean !== "0" && node.boolean !== "1") throw new Error(`Invalid XML-RPC boolean: ${node.boolean}`)
        return node.boolean === "1"
    }
    if ("int" in node) return decodeInteger(node.int, "int")
    if ("i4" in node) return decodeInteger(node.i4, "i4")
    if ("i8" in node) return decodeInteger(node.i8, "i8")
    if ("double" in node) {
        const value = Number(node.double)
        if (!Number.isFinite(value)) throw new Error(`Invalid XML-RPC double: ${node.double}`)
        return value
    }
    if ("base64" in node) return Buffer.from(node.base64, "base64")
    if ("dateTime.iso8601" in node) return decodeDate(node["dateTime.iso8601"])
    if ("nil" in node) return null
    if ("array" in node) {
        return (node.array?.data?.value ?? []).map(decodeValue)
    }
    if ("struct" in node) {
        return Object.fromEntries((node.struct?.member ?? []).map((member: any) => [member.name, decodeValue(member.value)]))
    }

    throw new Error("Unsupported XML-RPC response value")
}

function decodeInteger(value: string, type: "int" | "i4" | "i8"): number | bigint {
    if (!/^[+-]?\d+$/.test(value)) {
        throw new Error(`Invalid XML-RPC ${type}: ${value}`)
    }

    const integer = BigInt(value)
    return integer >= BigInt(Number.MIN_SAFE_INTEGER) && integer <= BigInt(Number.MAX_SAFE_INTEGER)
        ? Number(integer)
        : integer
}

function decodeDate(value: string): Date {
    const compact = /^(\d{4})(\d{2})(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z)?$/.exec(value)
    const date = compact
        ? new Date(Date.UTC(Number(compact[1]), Number(compact[2]) - 1, Number(compact[3]), Number(compact[4]), Number(compact[5]), Number(compact[6])))
        : new Date(value)

    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid XML-RPC dateTime.iso8601: ${value}`)
    }

    return date
}

export function parseXmlRpcResponse(xml: string): any {
    if (/<!DOCTYPE/i.test(xml)) {
        throw new Error("XML-RPC response contains a forbidden document type declaration")
    }
    const validation = XMLValidator.validate(xml)
    if (validation !== true) {
        throw new Error(`Invalid XML-RPC response: ${validation.err.msg}`)
    }

    const response = parser.parse(xml)?.methodResponse
    if (!response || typeof response !== "object") {
        throw new Error("Invalid XML-RPC response")
    }
    if (response.fault) {
        if (typeof response.fault !== "object" || !("value" in response.fault)) {
            throw new Error("Invalid XML-RPC fault response")
        }
        const fault = decodeValue(response.fault.value)
        if (!fault || typeof fault !== "object" || !("faultCode" in fault) || !("faultString" in fault)) {
            throw new Error("Invalid XML-RPC fault response")
        }
        const error = new Error(fault.faultString || `XML-RPC fault ${fault.faultCode}`)
        Object.assign(error, fault)
        throw error
    }

    const params = response.params?.param
    if (!Array.isArray(params) || params.length !== 1 || !params[0] || typeof params[0] !== "object" || !("value" in params[0])) {
        throw new Error("Invalid XML-RPC response parameters")
    }

    return decodeValue(params[0].value)
}

export class XmlRpcClient {
    constructor(private readonly endpoint: URL, private readonly options: XmlRpcClientOptions = {}) {}

    async call<T = any>(method: string, params: XmlRpcValue[] = []): Promise<T> {
        const body = `<?xml version="1.0"?><methodCall><methodName>${escapeXml(method)}</methodName><params>${params.map((param) => `<param>${encodeValue(param)}</param>`).join("")}</params></methodCall>`
        const transport = this.endpoint.protocol === "https:" ? https : http

        return new Promise<T>((resolve, reject) => {
            const request = transport.request(this.endpoint, {
                method: "POST",
                auth: this.endpoint.username
                    ? `${decodeURIComponent(this.endpoint.username)}:${decodeURIComponent(this.endpoint.password)}`
                    : undefined,
                ca: this.options.ca,
                rejectUnauthorized: this.options.rejectUnauthorized,
                timeout: this.options.timeout,
                headers: {
                    "User-Agent": "Electorrent XML-RPC Client",
                    "Content-Type": "text/xml",
                    Accept: "text/xml",
                    "Content-Length": Buffer.byteLength(body),
                    ...this.options.headers,
                },
            }, (response) => {
                const chunks: Buffer[] = []
                response.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
                response.on("aborted", () => reject(new Error("XML-RPC response was aborted")))
                response.on("error", reject)
                response.on("end", () => {
                    const responseBody = Buffer.concat(chunks).toString("utf8")
                    if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
                        reject(new Error(`XML-RPC request failed with HTTP ${response.statusCode ?? "unknown"}: ${responseBody}`))
                        return
                    }

                    try {
                        resolve(parseXmlRpcResponse(responseBody) as T)
                    } catch (error) {
                        reject(error)
                    }
                })
            })

            request.on("timeout", () => request.destroy(new Error(`XML-RPC request timed out after ${this.options.timeout}ms`)))
            request.on("error", reject)
            request.end(body)
        })
    }
}
