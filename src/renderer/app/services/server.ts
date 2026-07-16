import _ from "underscore"
import type { IPromise, IQService } from "angular"
import { Torrent } from "@renderer/app/bittorrent"
import type { TorrentClient } from "@renderer/app/bittorrent/torrentclient"
import type { ColumnProps } from "@renderer/app/services/column"
import { parseServerAddressInput, sanitizeServerAddress } from "@shared/server-address"
import type { CertificateResponseService } from "@renderer/app/services/certificate-response"
import type { LabelColorHue, LabelColorOverrides, SavedLocationConfig, StoredServerConfig, TorrentUploadOptions } from "@shared/ipc-contract"
import { normalizeLabelColorHue } from "@renderer/app/services/label-colors"

type NotificationService = {
    alert(title: string, message: string): void
    alertAuth(error: unknown): void
}

type BittorrentService = {
    getClient(name: string): TorrentClient
    setServer(server: Server): void
}

type BittorrentClientMetadata = Record<string, { name: string, icon: string }>

type ServerDependencies = {
    $q: IQService
    $notify: NotificationService
    $bittorrent: BittorrentService
    $btclients: BittorrentClientMetadata
    certificateResponseService: CertificateResponseService
}

const TLS_CERTIFICATE_ERROR_CODES = new Set([
    "DEPTH_ZERO_SELF_SIGNED_CERT",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "CERT_HAS_EXPIRED",
    "ERR_TLS_CERT_ALTNAME_INVALID",
])

function isTlsCertificateError(err: any): boolean {
    if (!err) return false
    if (err.code && TLS_CERTIFICATE_ERROR_CODES.has(err.code)) return true
    if (Array.isArray(err.errors) && err.errors.some(isTlsCertificateError)) return true
    if (err.cause && isTlsCertificateError(err.cause)) return true

    const message = String(err.message || err).toLowerCase()
    return Array.from(TLS_CERTIFICATE_ERROR_CODES).some((code) => message.includes(code.toLowerCase()))
        || message.includes("self signed certificate")
        || message.includes("certificate")
}

function isStaleConnectionError(err: any): boolean {
    return err?.kind === "cancelled" || String(err?.message || err).toLowerCase().includes("stale bittorrent connection")
}

function normalizeSavedLocations(savedLocations?: SavedLocationConfig[]): SavedLocationConfig[] {
    if (!Array.isArray(savedLocations)) return []
    return savedLocations
        .filter((savedLocation) => !!savedLocation?.path && !!savedLocation?.icon)
        .map((savedLocation) => ({ path: savedLocation.path, icon: savedLocation.icon }))
}

function normalizeDefaultUploadOptions(options?: TorrentUploadOptions): TorrentUploadOptions {
    return Object.assign({ startTorrent: true }, options || {})
}

function normalizeLabelColors(labelColors?: LabelColorOverrides): LabelColorOverrides {
    if (!labelColors || typeof labelColors !== "object") return {}
    return Object.keys(labelColors).reduce((normalized: Record<string, LabelColorHue>, label) => {
        const hue = normalizeLabelColorHue(labelColors[label])
        if (label && hue !== undefined) normalized[label] = hue
        return normalized
    }, {})
}

export class Server implements Omit<StoredServerConfig, "columns"> {
    private static dependencies: ServerDependencies

    name?: string
    id: string
    ip: string
    proto: string
    port: number
    user: string
    password: string
    client: string
    path: string
    default?: boolean
    lastused?: number
    certificate?: string
    tlsSecurity?: "default" | "insecure"
    columns: ColumnProps[]
    savedLocations?: SavedLocationConfig[]
    defaultUploadOptionsEnabled?: boolean
    defaultUploadOptions?: TorrentUploadOptions
    labelColors?: LabelColorOverrides
    certificateData?: Uint8Array
    isConnected: boolean

    static configure(dependencies: ServerDependencies): typeof Server {
        Server.dependencies = dependencies
        return Server
    }

    constructor(data: StoredServerConfig)
    constructor(ip: string, port: number, user: string, password: string, client: string)
    constructor(ip?: string, proto?: string, port?: number, user?: string, password?: string, client?: string, path?: string)
    constructor(ipOrData?: string | StoredServerConfig, protoOrPort?: string | number, portOrUser?: number | string, userOrPassword?: string, passwordOrClient?: string, client?: string, path?: string) {
        this.certificateData = undefined
        if (typeof ipOrData === "object") {
            this.fromJson(ipOrData)
        } else {
            this.id = generateGUID()
            this.ip = ipOrData || ""
            if (typeof protoOrPort === "number") {
                this.proto = "http"
                this.port = protoOrPort
                this.user = String(portOrUser || "")
                this.password = userOrPassword || ""
                this.client = passwordOrClient
            } else {
                this.proto = protoOrPort
                this.port = portOrUser as number
                this.user = userOrPassword || ""
                this.password = passwordOrClient || ""
                this.client = client
            }
            this.path = path
            this.lastused = -1
            this.columns = this.defaultColumns()
            this.savedLocations = []
            this.labelColors = {}
            this.defaultUploadOptionsEnabled = false
            this.defaultUploadOptions = normalizeDefaultUploadOptions()
        }
        this.isConnected = false
    }

    fromJson(data: StoredServerConfig & { certificateData?: Uint8Array }): void {
        this.name = data.name
        this.id = data.id
        this.ip = data.ip || ""
        this.proto = data.proto || "http"
        this.port = data.port
        this.user = data.user || ""
        this.password = data.password || ""
        this.client = data.client
        this.path = data.path || ""
        this.default = data.default
        this.lastused = data.lastused
        this.certificate = data.certificate
        this.tlsSecurity = data.tlsSecurity === "insecure" ? "insecure" : "default"
        this.certificateData = data.certificateData ? new Uint8Array(data.certificateData) : undefined
        this.columns = this.parseColumns(data.columns)
        this.savedLocations = normalizeSavedLocations(data.savedLocations)
        this.defaultUploadOptionsEnabled = data.defaultUploadOptionsEnabled === true
        this.defaultUploadOptions = normalizeDefaultUploadOptions(data.defaultUploadOptions)
        this.labelColors = normalizeLabelColors(data.labelColors)
    }

    json(): StoredServerConfig {
        return {
            name: this.name,
            id: this.id,
            ip: this.ip,
            proto: this.proto,
            port: this.port,
            user: this.user,
            password: this.password,
            client: this.client,
            path: this.path,
            default: this.default,
            lastused: this.lastused || -1,
            certificate: this.tlsSecurity === "insecure" ? undefined : this.certificate,
            tlsSecurity: this.isHTTPS() && this.tlsSecurity === "insecure" ? "insecure" : undefined,
            columns: this.columns.filter((column) => column.enabled).map((column) => column.name),
            savedLocations: normalizeSavedLocations(this.savedLocations),
            defaultUploadOptionsEnabled: this.defaultUploadOptionsEnabled === true,
            defaultUploadOptions: normalizeDefaultUploadOptions(this.defaultUploadOptions),
            labelColors: normalizeLabelColors(this.labelColors),
        }
    }

    getName(): string {
        return Server.dependencies.$btclients[this.client].name
    }

    getIcon(): string {
        return Server.dependencies.$btclients[this.client].icon
    }

    getNameAtAddress(): string {
        return this.getName() + " @ " + this.ip
    }

    getDisplayName(): string {
        return this.name || this.getNameAtAddress()
    }

    updateLastUsed(): void {
        this.lastused = new Date().getTime()
    }

    cleanPath(): string {
        const path = trim(this.path, "/")
        return path ? "/" + path : ""
    }

    url(): string {
        const server = sanitizeServerAddress(this)
        return `${server.proto}://${server.ip}:${server.port}${this.cleanPath()}`
    }

    isHTTPS(): boolean {
        const parsed = parseServerAddressInput(this.ip, this.proto)
        return (parsed.protocol || this.proto) === "https"
    }

    setPath(): void {
        const client = Server.dependencies.$bittorrent.getClient(this.client)
        this.path = client?.defaultPath ? client.defaultPath() : "/"
    }

    connect(): IPromise<void> {
        const { $q, $notify, $bittorrent } = Server.dependencies
        Object.assign(this, sanitizeServerAddress(this))

        if (!this.client) {
            $notify.alert("Opps!", "Please select a client to connect to!")
            return $q.reject()
        }

        return $q.when($bittorrent.getClient(this.client).connect(this) as any).catch((err: any) => {
            this.isConnected = false
            if (this.isHTTPS() && (err?.kind === "tls" || isTlsCertificateError(err))) {
                return this.askForCertificate().then(() => this.connect())
            }
            if (!isStaleConnectionError(err)) $notify.alertAuth(err)
            return $q.reject(err)
        }).then(() => {
            this.isConnected = true
            $bittorrent.setServer(this)
            return $q.resolve()
        })
    }

    askForCertificate(): IPromise<void> {
        const { $q, certificateResponseService } = Server.dependencies
        const response = certificateResponseService.wait(this.id)

        window.electorrent.certificates.fetch({ server: this.json() }).catch((err: unknown) => {
            certificateResponseService.reject(this.id, err)
        })

        return $q.when(response as any).then((result) => {
            if ("tlsSecurity" in result) {
                this.tlsSecurity = "insecure"
                this.certificate = undefined
                this.certificateData = undefined
                return
            }

            this.tlsSecurity = "default"
            this.certificate = result.fingerprint
            return $q.when(window.electorrent.certificates.load(result.fingerprint) as any).then((certificateData) => {
                this.certificateData = certificateData ? new Uint8Array(certificateData) : undefined
            })
        })
    }

    getCertificate(): Uint8Array | undefined {
        return this.tlsSecurity === "insecure" ? undefined : this.certificateData
    }

    equals(other: Server): boolean {
        return this.ip === other.ip
            && this.proto === other.proto
            && this.port === other.port
            && this.user === other.user
            && this.password === other.password
            && this.client === other.client
            && this.path === other.path
            && this.certificate === other.certificate
            && this.tlsSecurity === other.tlsSecurity
    }

    parseColumns(data?: string[]): ColumnProps[] {
        const columns = this.defaultColumns()
        if (!data || data.length === 0) return columns
        columns.sort(zipSort(data))
        columns.forEach((column) => {
            column.enabled = data.some((entry) => entry === column.name)
        })
        return columns
    }

    defaultColumns(): ColumnProps[] {
        let columns: ColumnProps[] = []
        angular.copy(Torrent.COLUMNS, columns)
        columns = this.addCustomColumns(columns)
        return columns
    }

    addCustomColumns(columns: ColumnProps[]): ColumnProps[] {
        if (!this.client) return columns
        const client = Server.dependencies.$bittorrent.getClient(this.client)
        return _.union(columns, client.extraColumns)
    }

    bootstrap(): void {
        this.columns = this.addCustomColumns(this.columns)
    }
}

function trim(value: string, mask: string): string {
    while (~mask.indexOf(value[0])) value = value.slice(1)
    while (~mask.indexOf(value[value.length - 1])) value = value.slice(0, -1)
    return value
}

function zipSort(order: string[]) {
    return (a: ColumnProps, b: ColumnProps): number => {
        const left = order.indexOf(a.name)
        const right = order.indexOf(b.name)
        if (left === right) return 0
        if (left === -1) return 1
        if (right === -1) return -1
        return left - right
    }
}

function generateGUID(): string {
    return s4() + s4() + "-" + s4() + "-" + s4() + "-" + s4() + "-" + s4() + s4() + s4()
}

function s4(): string {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1)
}

export const serverService = ["$q", "notificationService", "$bittorrent", "$btclients", "certificateResponseService",
    ($q: IQService, $notify: NotificationService, $bittorrent: BittorrentService, $btclients: BittorrentClientMetadata, certificateResponseService: CertificateResponseService) => Server.configure({
        $q,
        $notify,
        $bittorrent,
        $btclients,
        certificateResponseService,
    }),
]
