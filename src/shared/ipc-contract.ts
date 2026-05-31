export type Unsubscribe = () => void

export interface AppMeta {
    appName: string
    appVersion: string
    isMacOS: boolean
    isWindows: boolean
    isLinux: boolean
    isDebug: boolean
    platform: string
    versions: {
        node: string
        chrome: string
        electron: string
    }
}

export interface ThemeInfo {
    css: string
    basename: string
    theme: string
}

export interface NotificationPayload {
    title: string
    message: string
    type?: string
    delay?: number
}

export interface PendingTorrentUploadFile {
    type: "file"
    data: Uint8Array
    filename: string
    askUploadOptions?: boolean
}

export interface BittorrentServerConfig extends StoredServerConfig {
    certificateData?: Uint8Array
}

export interface BittorrentSnapshotRequest {
    fullUpdate?: boolean
}

export interface BittorrentAddTorrentUrlRequest {
    uri: string
    options?: Record<string, any>
}

export interface BittorrentUploadTorrentRequest {
    data: Uint8Array
    filename: string
    options?: Record<string, any>
}

export interface BittorrentInvokeActionRequest {
    action: string
    hashes?: string[]
    args?: any[]
}

export interface BittorrentGetTorrentFilesRequest {
    hash: string
}

export type BittorrentTorrentDetailsPrimitive = string | number | boolean | null

export interface BittorrentGetTorrentDetailsRequest {
    hash: string
}

export interface BittorrentTorrentDetailsFile {
    index: number
    path: string
    name: string
    size: number
    progress: number
    availability?: number
    priority?: number
    wanted?: boolean
    isSeed?: boolean
}

export interface BittorrentTorrentDetailsData {
    info: Record<string, BittorrentTorrentDetailsPrimitive>
    files: BittorrentTorrentDetailsFile[]
}

export interface BittorrentFileSelection {
    index: number
    path: string
    name: string
    size: number
    wanted: boolean
    priority?: number
}

export interface BittorrentSetTorrentFileSelectionRequest {
    hash: string
    files: BittorrentFileSelection[]
}

export interface LaunchPayload {
    magnets: string[]
    torrentFiles: PendingTorrentUploadFile[]
}

export interface StoredServerConfig {
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
    columns: string[]
}

export interface AppSettings<TServer = StoredServerConfig> {
    startup: string
    refreshRate: number
    automaticUpdates?: boolean
    closeToTray?: boolean
    debugMode?: boolean
    autoRemoveTorrents?: boolean
    alwaysPromptUploadOptions?: boolean
    watchDirectory?: string
    ui: {
        resizeMode: string
        notifications: boolean
        displaySize: string
        displayCompact: boolean
        cleanNames: boolean
        fixedHeader: boolean
        theme: string
        sidebarCollapsed: boolean
    }
    servers: TServer[]
    certificates: string[]
}

export interface UpdateEvent {
    type: "checking" | "available" | "downloaded" | "up-to-date" | "error"
    message?: string
    data?: {
        manual?: boolean
        updateUrl?: string
        releaseNotes?: string
        releaseDate?: string
        [key: string]: any
    }
}

export interface CertificateIdentity {
    country?: string
    state?: string
    organization?: string
    organizationUnit?: string
    commonName?: string
}

export interface CertificatePrompt {
    source: string
    serverId?: string
    selfSigned: boolean
    issuer: CertificateIdentity
    subject: CertificateIdentity
    fingerprint: string
    validFrom: number
    validTo: number
    serialNumber: string
    raw?: Uint8Array
}

export interface CertificateFetchRequest {
    server: StoredServerConfig
}

export interface CertificateInstallRequest {
    fingerprint: string
    raw?: Uint8Array
}

export interface CertificateInstallResult {
    fingerprint: string
}

export type MenuAction =
    | { type: "show-settings" }
    | { type: "show-servers" }
    | { type: "search-torrent" }
    | { type: "select-all" }
    | { type: "remove-selected" }
    | { type: "open-add-torrent"; askUploadOptions?: boolean }
    | { type: "paste-torrent-url"; askUploadOptions?: boolean }
    | { type: "open-external"; url: string }
    | { type: "check-for-updates"; verbose?: boolean }
    | { type: "connect-server"; serverId: string }
    | { type: "set-current-default-server" }
    | { type: "add-server" }

export interface ElectorrentBridge {
    app: {
        getMeta(): Promise<AppMeta>
        getDefaultProtocolStatus(protocol: string): Promise<boolean>
        setDefaultProtocolStatus(protocol: string, enabled: boolean): Promise<void>
        quit(): Promise<void>
        reportCorruptSettings(): Promise<void>
    }
    shell: {
        openExternal(url: string): Promise<void>
    }
    settings: {
        getAll(): Promise<AppSettings>
        saveAll(settings: AppSettings): Promise<void>
        listThemes(): Promise<ThemeInfo[]>
        chooseWatchDirectory(currentPath?: string): Promise<string | null>
    }
    launch: {
        getPending(): Promise<LaunchPayload>
        onMagnets(callback: (magnets: string[]) => void): Unsubscribe
        onTorrentFiles(callback: (files: PendingTorrentUploadFile[]) => void): Unsubscribe
    }
    torrents: {
        openFiles(askUploadOptions: boolean): Promise<PendingTorrentUploadFile[]>
    }
    bittorrent: {
        connect(server: BittorrentServerConfig): Promise<void>
        disconnect(): Promise<void>
        getSnapshot(request?: BittorrentSnapshotRequest): Promise<any>
        addTorrentUrl(request: BittorrentAddTorrentUrlRequest): Promise<void>
        uploadTorrent(request: BittorrentUploadTorrentRequest): Promise<void>
        invokeAction(request: BittorrentInvokeActionRequest): Promise<void>
        getTorrentDetails(request: BittorrentGetTorrentDetailsRequest): Promise<BittorrentTorrentDetailsData>
        getTorrentFiles(request: BittorrentGetTorrentFilesRequest): Promise<any>
        setTorrentFileSelection(request: BittorrentSetTorrentFileSelectionRequest): Promise<void>
    }
    updates: {
        check(verbose?: boolean): Promise<void>
        installDownloaded(): Promise<void>
        installAuto(): Promise<void>
        onStatus(callback: (event: UpdateEvent) => void): Unsubscribe
    }
    certificates: {
        fetch(request: CertificateFetchRequest): Promise<CertificatePrompt>
        install(request: CertificateInstallRequest): Promise<CertificateInstallResult>
        load(fingerprint: string): Promise<Uint8Array | null>
        onChallenge(callback: (prompt: CertificatePrompt) => void): Unsubscribe
    }
    notifications: {
        onPush(callback: (notification: NotificationPayload) => void): Unsubscribe
    }
    menu: {
        onAction(callback: (action: MenuAction) => void): Unsubscribe
    }
    clipboard: {
        readText(): string
    }
}
