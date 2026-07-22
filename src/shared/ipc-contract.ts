import type { TorrentActionItem } from "./torrent-actions"

export type Unsubscribe = () => void

export type ColorTheme = "light" | "dark"
export type ThemePreference = ColorTheme | "system"
export type SystemStartupOption = "disabled" | "open" | "background"

export interface AppMeta {
    appName: string
    appVersion: string
    isMacOS: boolean
    isWindows: boolean
    isLinux: boolean
    isDebug: boolean
    forceTitleBarMenu: boolean
    platform: string
    versions: {
        node: string
        chrome: string
        electron: string
    }
}

export interface ThemeInfo {
    css: string
    basename: ThemePreference
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
    sourcePath?: string
    askUploadOptions?: boolean
    metadata?: TorrentMetadata
}

export interface PendingTorrentUploadLink {
    type: "link"
    uri: string
    askUploadOptions?: boolean
    metadata?: TorrentMetadata
}

export interface TorrentMetadataFile {
    name: string
    path: string
    length: number
}

export interface TorrentMetadata {
    name?: string
    infoHash?: string
    length?: number
    announce: string[]
    files: TorrentMetadataFile[]
}

export type ParseTorrentRequest =
    | { uri: string }
    | { data: Uint8Array }

export type TlsSecurity = "default" | "insecure"

export interface BittorrentServerConfig extends StoredServerConfig {
    certificateData?: Uint8Array
}

export interface BittorrentSnapshotRequest {
    fullUpdate?: boolean
}

export interface BittorrentAddTorrentUrlRequest {
    uri: string
    options?: TorrentUploadOptions
}

export interface BittorrentUploadTorrentRequest {
    data: Uint8Array
    filename: string
    options?: TorrentUploadOptions
    sourcePath?: string
}

export interface BittorrentInvokeActionRequest {
    action: string
    hashes?: string[]
    args?: unknown[]
}

export interface BittorrentGetTorrentFilesRequest {
    hash: string
}

export interface BittorrentGetTorrentPeersRequest {
    hash: string
}

export interface BittorrentGetTorrentTrackersRequest {
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
    wanted: boolean
    isSeed?: boolean
}

export interface BittorrentTorrentDetailsTracker {
    url: string
    status?: string
    tier?: number
    peers?: number
    seeds?: number
    leeches?: number
    downloaded?: number
    message?: string
    lastAnnounce?: number
    nextAnnounce?: number
}

export interface BittorrentTorrentDetailsData {
    info: Record<string, BittorrentTorrentDetailsPrimitive>
}

export interface BittorrentTorrentPeer {
    ip: string
    port?: number
    client: string
    progress: number
    downloadSpeed: number
    uploadSpeed: number
    downloaded?: number
    uploaded?: number
    connection?: string
    flags?: string
    country?: string
    countryCode?: string
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
    magnets: PendingTorrentUploadLink[]
    torrentFiles: PendingTorrentUploadFile[]
}

export type LabelColorHue = number

export type LabelColorOverrides = Partial<Record<string, LabelColorHue>>

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
    tlsSecurity?: TlsSecurity
    columns: string[]
    savedLocations?: SavedLocationConfig[]
    defaultUploadOptionsEnabled?: boolean
    defaultUploadOptions?: TorrentUploadOptions
    labelColors?: LabelColorOverrides
}

export interface SavedLocationConfig {
    path: string
    icon: string
}

export interface TorrentUploadOptions {
    saveLocation?: string
    renameTorrent?: string
    category?: string
    startTorrent?: boolean
    peerLimit?: number
    skipCheck?: boolean
    sequentialDownload?: boolean
    firstAndLastPiecePrio?: boolean
    downloadSpeedLimit?: number
    uploadSpeedLimit?: number
    fileSelection?: BittorrentFileSelection[]
}

export interface TorrentSpeedLimitOptions {
    downloadSpeedLimit?: number
    uploadSpeedLimit?: number
}

export type TorrentUploadOptionsEnable = Partial<Record<keyof TorrentUploadOptions, boolean>>

export interface TorrentClientFeatures {
    readonly magnetLinks?: boolean
    readonly labels?: boolean
    readonly fileSelection?: boolean
    readonly uploadFileSelection?: boolean
    readonly setLocation?: boolean
    readonly torrentDetails?: boolean
    readonly torrentPeers?: boolean
    readonly trackerFilter?: boolean
    readonly alternativeSpeedLimits?: boolean
    readonly speedLimits?: boolean
    readonly ratioLimits?: boolean
    readonly freeDiskSpace?: boolean
    readonly uploadOptions?: Readonly<TorrentUploadOptionsEnable>
}

export interface TorrentClientConnection {
    readonly version: string
    readonly features: TorrentClientFeatures
}

export type BittorrentConnectionErrorKind =
    | "authentication"
    | "timeout"
    | "unreachable"
    | "address"
    | "tls"
    | "server"
    | "response"
    | "cancelled"
    | "unknown"

export interface BittorrentConnectionError {
    readonly kind: BittorrentConnectionErrorKind
    readonly message: string
    readonly code?: string
}

export type BittorrentConnectResult =
    | { readonly ok: true; readonly connection: TorrentClientConnection }
    | { readonly ok: false; readonly error: BittorrentConnectionError }

export interface ResolvedTorrentClientFeatures {
    readonly magnetLinks: boolean
    readonly labels: boolean
    readonly fileSelection: boolean
    readonly uploadFileSelection: boolean
    readonly setLocation: boolean
    readonly torrentDetails: boolean
    readonly torrentPeers: boolean
    readonly trackerFilter: boolean
    readonly alternativeSpeedLimits: boolean
    readonly speedLimits: boolean
    readonly ratioLimits: boolean
    readonly freeDiskSpace: boolean
    readonly uploadOptions: Readonly<Required<Record<keyof TorrentUploadOptions, boolean>>>
}

export interface AppSettings<TServer = StoredServerConfig> {
    startup: string
    systemStartup: SystemStartupOption
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
        theme: ThemePreference
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
    | { type: "remove-and-delete-selected" }
    | { type: "open-add-torrent"; askUploadOptions?: boolean }
    | { type: "paste-torrent-url"; askUploadOptions?: boolean }
    | { type: "open-external"; url: string }
    | { type: "check-for-updates"; verbose?: boolean }
    | { type: "connect-server"; serverId: string }
    | { type: "set-current-default-server" }
    | { type: "add-server" }
    | { type: "torrent-action"; action: TorrentActionItem }

export type WindowCommand =
    | "reload"
    | "toggle-full-screen"
    | "toggle-dev-tools"
    | "minimize"
    | "close"

export type EditCommand =
    | "undo"
    | "redo"
    | "cut"
    | "copy"
    | "paste"

export interface ElectorrentBridge {
    app: {
        initialTheme: ColorTheme
        isTestEnvironment: boolean
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
        getSystemTheme(): Promise<ColorTheme>
        onSystemThemeChanged(callback: (theme: ColorTheme) => void): Unsubscribe
        chooseWatchDirectory(currentPath?: string): Promise<string | null>
    }
    launch: {
        getPending(): Promise<LaunchPayload>
        onMagnets(callback: (magnets: PendingTorrentUploadLink[]) => void): Unsubscribe
        onTorrentFiles(callback: (files: PendingTorrentUploadFile[]) => void): Unsubscribe
    }
    torrents: {
        openFiles(askUploadOptions: boolean): Promise<PendingTorrentUploadFile[]>
        parse(request: ParseTorrentRequest): Promise<TorrentMetadata>
        getPathForFile(file: File): string
    }
    bittorrent: {
        connect(server: BittorrentServerConfig): Promise<BittorrentConnectResult>
        disconnect(): Promise<void>
        getSnapshot(request?: BittorrentSnapshotRequest): Promise<any>
        addTorrentUrl(request: BittorrentAddTorrentUrlRequest): Promise<void>
        uploadTorrent(request: BittorrentUploadTorrentRequest): Promise<void>
        invokeAction(request: BittorrentInvokeActionRequest): Promise<void>
        getActions(): Promise<TorrentActionItem[]>
        setSelectedTorrents(hashes: string[]): Promise<void>
        getTorrentDetails(request: BittorrentGetTorrentDetailsRequest): Promise<BittorrentTorrentDetailsData>
        getTorrentFiles(request: BittorrentGetTorrentFilesRequest): Promise<BittorrentTorrentDetailsFile[]>
        getTorrentPeers(request: BittorrentGetTorrentPeersRequest): Promise<BittorrentTorrentPeer[]>
        getTorrentTrackers(request: BittorrentGetTorrentTrackersRequest): Promise<BittorrentTorrentDetailsTracker[]>
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
    edit: {
        command(command: EditCommand): Promise<void>
    }
    window: {
        command(command: WindowCommand): Promise<void>
    }
    menu: {
        getModel(): Promise<import("./title-menu").TitleMenuItem[]>
        onChanged(callback: (menu: import("./title-menu").TitleMenuItem[]) => void): Unsubscribe
        onAction(callback: (action: MenuAction) => void): Unsubscribe
    }
    clipboard: {
        readText(): Promise<string>
        writeText(text: string): Promise<void>
    }
}
