import axios, { type AxiosInstance, type AxiosResponse } from "axios"
import httpAdapter from "axios/lib/adapters/http.js"
import https from "node:https"

import { HTTP_REQUEST_TIMEOUT, serverUrl } from "@main/lib/bittorrent/helpers"
import type { BittorrentServerConfig } from "@shared/ipc-contract"

export interface Aria2RpcCall {
    method: string
    params?: unknown[]
}

interface JsonRpcRequest {
    jsonrpc: "2.0"
    id: string
    method: string
    params: unknown[]
}

interface JsonRpcErrorData {
    code: number
    message: string
    data?: unknown
}

interface JsonRpcResponse<T = unknown> {
    jsonrpc: "2.0"
    id: string | number | null
    result?: T
    error?: JsonRpcErrorData
}

export interface Aria2MulticallFault {
    faultCode: number
    faultString: string
}

let nextRequestId = 0

export class Aria2RpcError extends Error {
    readonly code: number
    readonly data?: unknown
    readonly faultCode?: number
    readonly faultString?: string

    constructor(error: JsonRpcErrorData | Aria2MulticallFault) {
        const isFault = "faultCode" in error
        super(isFault ? error.faultString : error.message)
        this.name = "Aria2RpcError"
        this.code = isFault ? error.faultCode : error.code
        this.data = isFault ? undefined : error.data
        this.faultCode = isFault ? error.faultCode : undefined
        this.faultString = isFault ? error.faultString : undefined
    }
}

function isMulticallFault(value: unknown): value is Aria2MulticallFault | JsonRpcErrorData {
    if (!value || typeof value !== "object") return false
    const fault = value as Record<string, unknown>
    return (typeof fault.faultCode === "number" && typeof fault.faultString === "string")
        || (typeof fault.code === "number" && typeof fault.message === "string")
}

export class Aria2JsonRpcTransport {
    private readonly http: AxiosInstance
    private readonly endpoint: string
    private readonly secret: string

    constructor(server: BittorrentServerConfig) {
        this.endpoint = serverUrl(server)
        this.secret = server.password || ""
        this.http = axios.create({
            adapter: httpAdapter,
            timeout: HTTP_REQUEST_TIMEOUT,
            auth: server.user ? { username: server.user, password: server.password } : undefined,
            httpsAgent: new https.Agent({
                ca: server.certificateData ? Buffer.from(server.certificateData) : undefined,
                rejectUnauthorized: server.tlsSecurity !== "insecure",
            }),
        })
    }

    async call<T = unknown>(method: string, params: unknown[] = [], timeout = HTTP_REQUEST_TIMEOUT): Promise<T> {
        const request = this.createRequest(method, params)
        try {
            const response = await this.http.post<JsonRpcResponse<T>>(this.endpoint, request, { timeout })
            return this.readResponse(response.data, request.id)
        } catch (error) {
            const response = axios.isAxiosError<JsonRpcResponse<T>>(error) ? error.response?.data : undefined
            if (this.isErrorResponse(response, request.id)) {
                throw new Aria2RpcError(response.error)
            }
            throw this.transportError(error)
        }
    }

    async batch<T = unknown>(calls: Aria2RpcCall[], timeout = HTTP_REQUEST_TIMEOUT): Promise<T[]> {
        if (calls.length === 0) return []

        const requests = calls.map(({ method, params }) => this.createRequest(method, params || []))
        let response: AxiosResponse<JsonRpcResponse<T>[]>
        try {
            response = await this.http.post<JsonRpcResponse<T>[]>(this.endpoint, requests, { timeout })
        } catch (error) {
            throw this.transportError(error)
        }
        if (!Array.isArray(response.data)) {
            throw new Error("aria2 returned an invalid JSON-RPC batch response")
        }

        const responses = new Map(response.data.map((item) => [String(item.id), item]))
        return requests.map((request) => {
            const item = responses.get(request.id)
            if (!item) {
                throw new Error(`aria2 omitted JSON-RPC response ${request.id}`)
            }
            return this.readResponse(item, request.id)
        })
    }

    async multicall<T = unknown>(calls: Aria2RpcCall[], timeout = HTTP_REQUEST_TIMEOUT): Promise<T[]> {
        if (calls.length === 0) return []

        const methods = calls.map(({ method, params }) => ({
            methodName: method,
            params: this.authorize(method, params || []),
        }))
        const results = await this.call<unknown[]>("system.multicall", [methods], timeout)
        if (!Array.isArray(results) || results.length !== calls.length) {
            throw new Error("aria2 returned an invalid system.multicall response")
        }

        return results.map((result) => {
            if (isMulticallFault(result)) throw new Aria2RpcError(result)
            if (!Array.isArray(result) || result.length !== 1) {
                throw new Error("aria2 returned an invalid system.multicall result")
            }
            return result[0] as T
        })
    }

    private createRequest(method: string, params: unknown[]): JsonRpcRequest {
        return {
            jsonrpc: "2.0",
            id: `aria2-${++nextRequestId}`,
            method,
            params: this.authorize(method, params),
        }
    }

    private authorize(method: string, params: unknown[]) {
        if (!this.secret || method === "system.multicall" || method === "system.listMethods" || method === "system.listNotifications") {
            return [...params]
        }
        return [`token:${this.secret}`, ...params]
    }

    private readResponse<T>(response: JsonRpcResponse<T>, id: string): T {
        if (!response || typeof response !== "object" || String(response.id) !== id) {
            throw new Error("aria2 returned an invalid JSON-RPC response")
        }
        if (response.error) throw new Aria2RpcError(response.error)
        if (!("result" in response)) throw new Error("aria2 JSON-RPC response did not contain a result")
        return response.result as T
    }

    private isErrorResponse<T>(response: JsonRpcResponse<T> | undefined, id: string): response is JsonRpcResponse<T> & { error: JsonRpcErrorData } {
        return Boolean(response
            && response.jsonrpc === "2.0"
            && String(response.id) === id
            && response.error
            && typeof response.error.code === "number"
            && typeof response.error.message === "string")
    }

    private transportError(error: unknown): unknown {
        if (axios.isAxiosError(error) && !error.response && error.cause instanceof Error) {
            return error.cause
        }
        return error
    }
}
