import { CLIENT_METADATA } from "./client-metadata"
import type { AppSettings, EditCommand, MenuAction, StoredServerConfig, Unsubscribe, WindowCommand } from "./ipc-contract"

export type TitleMenuPlatform = "darwin" | "linux" | "win32"

export type TitleMenuAction =
    | MenuAction
    | { type: "quit" }
    | { type: "edit-command"; command: EditCommand }
    | { type: "window-command"; command: WindowCommand }

export type TitleMenuNativeRole =
    | "about"
    | "close"
    | "copy"
    | "cut"
    | "front"
    | "help"
    | "hide"
    | "hideOthers"
    | "minimize"
    | "paste"
    | "quit"
    | "redo"
    | "services"
    | "undo"
    | "unhide"
    | "window"
    | "zoom"

export interface TitleMenuItem {
    id?: string
    label?: string
    accelerator?: string
    type?: "normal" | "radio" | "separator"
    checked?: boolean
    enabled?: boolean
    visible?: boolean
    nativeRole?: TitleMenuNativeRole
    action?: TitleMenuAction
    submenu?: TitleMenuItem[]
}

export interface TitleMenuState {
    appName: string
    platform: TitleMenuPlatform
    isDebug: boolean
    settings: Pick<AppSettings, "servers">
    session: {
        activeServerId: string | null
        activeClientId: string | null
        isConnected: boolean
    }
}

export interface TitleMenuSources {
    getSettings(): Pick<AppSettings, "servers">
    subscribeSettings(listener: () => void): Unsubscribe
    getSession(): TitleMenuState["session"]
    subscribeSession(listener: () => void): Unsubscribe
}

const separator = (): TitleMenuItem => ({ type: "separator" })

function serverAccelerator(index: number, platform: TitleMenuPlatform) {
    if (index <= 0 || index > 10) return undefined
    return `${platform === "darwin" ? "CmdOrCtrl" : "Ctrl"}+${index % 10}`
}

function getServerLabel(server: StoredServerConfig) {
    const clientName = CLIENT_METADATA[server.client as keyof typeof CLIENT_METADATA]?.name || server.client || "Server"
    return server.name || `${clientName} @ ${server.ip || "unknown host"}`
}

export function deriveTitleMenu(state: TitleMenuState): TitleMenuItem[] {
    const { appName, isDebug, platform, session, settings } = state
    const isDarwin = platform === "darwin"
    const hasActiveServer = !!session.activeServerId
    const hasConnectedServer = hasActiveServer && session.isConnected
    const advancedUploadVisible = !!session.activeClientId
        && !!CLIENT_METADATA[session.activeClientId as keyof typeof CLIENT_METADATA]?.showAdvancedUploadMenu

    const fileItems: TitleMenuItem[] = [
        {
            label: "Add Torrent",
            accelerator: "CmdOrCtrl+O",
            enabled: hasConnectedServer,
            action: { type: "open-add-torrent", askUploadOptions: false },
        },
        {
            label: "Add Torrent (Advanced)",
            accelerator: isDarwin ? "CmdOrCtrl+Alt+O" : "Ctrl+Shift+O",
            visible: advancedUploadVisible,
            enabled: hasConnectedServer && advancedUploadVisible,
            action: { type: "open-add-torrent", askUploadOptions: true },
        },
        {
            label: "Paste Torrent URL",
            accelerator: "CmdOrCtrl+I",
            enabled: hasConnectedServer,
            action: { type: "paste-torrent-url", askUploadOptions: false },
        },
        {
            label: "Paste Torrent URL (Advanced)",
            accelerator: isDarwin ? "CmdOrCtrl+Alt+I" : "Ctrl+Shift+I",
            visible: advancedUploadVisible,
            enabled: hasConnectedServer && advancedUploadVisible,
            action: { type: "paste-torrent-url", askUploadOptions: true },
        },
    ]

    const editItems: TitleMenuItem[] = [
        { label: "Undo", accelerator: "CmdOrCtrl+Z", nativeRole: "undo", action: { type: "edit-command", command: "undo" } },
        { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", nativeRole: "redo", action: { type: "edit-command", command: "redo" } },
        separator(),
        { label: "Find", accelerator: "CmdOrCtrl+F", action: { type: "search-torrent" } },
        { label: "Cut", accelerator: "CmdOrCtrl+X", nativeRole: "cut", action: { type: "edit-command", command: "cut" } },
        { label: "Copy", accelerator: "CmdOrCtrl+C", nativeRole: "copy", action: { type: "edit-command", command: "copy" } },
        { label: "Paste", accelerator: "CmdOrCtrl+V", nativeRole: "paste", action: { type: "edit-command", command: "paste" } },
        { label: "Remove", accelerator: "Delete", action: { type: "remove-selected" } },
        { label: "Remove and Delete", accelerator: "CmdOrCtrl+Delete", action: { type: "remove-and-delete-selected" } },
        { label: "Select All", accelerator: "CmdOrCtrl+A", action: { type: "select-all" } },
    ]

    const viewItems: TitleMenuItem[] = [
        {
            label: "Reload",
            accelerator: "CmdOrCtrl+R",
            visible: isDebug,
            action: { type: "window-command", command: "reload" },
        },
        {
            label: "Toggle Full Screen",
            accelerator: isDarwin ? "Ctrl+Command+F" : "F11",
            action: { type: "window-command", command: "toggle-full-screen" },
        },
        {
            label: "Toggle Developer Tools",
            accelerator: isDarwin ? "Alt+Command+I" : "Ctrl+Shift+I",
            visible: isDebug,
            action: { type: "window-command", command: "toggle-dev-tools" },
        },
    ]

    const serverItems: TitleMenuItem[] = [
        { label: "Add new server...", accelerator: "CmdOrCtrl+N", action: { type: "add-server" } },
        {
            label: "Set current as default",
            enabled: hasActiveServer,
            action: { type: "set-current-default-server" },
        },
        separator(),
    ]

    if (settings.servers.length === 0) {
        serverItems.push({ label: "No servers", enabled: false })
    } else {
        settings.servers.forEach((server, index) => {
            serverItems.push({
                label: getServerLabel(server),
                accelerator: serverAccelerator(index + 1, platform),
                type: "radio",
                checked: server.id === session.activeServerId,
                action: { type: "connect-server", serverId: server.id },
            })
        })
    }

    const helpItems: TitleMenuItem[] = [
        {
            label: "Learn More",
            action: { type: "open-external", url: "https://github.com/tympanix/Electorrent" },
        },
        { label: "Check For Updates", action: { type: "check-for-updates", verbose: true } },
    ]

    if (isDarwin) {
        return [
            {
                label: appName,
                submenu: [
                    { label: `About ${appName}`, nativeRole: "about" },
                    separator(),
                    { label: "Preferences", accelerator: "Command+,", action: { type: "show-settings" } },
                    { label: "Services", nativeRole: "services", submenu: [] },
                    separator(),
                    { label: `Hide ${appName}`, accelerator: "Command+H", nativeRole: "hide" },
                    { label: "Hide Others", accelerator: "Command+Alt+H", nativeRole: "hideOthers" },
                    { label: "Show All", nativeRole: "unhide" },
                    separator(),
                    { label: "Quit", accelerator: "Command+Q", nativeRole: "quit", action: { type: "quit" } },
                ],
            },
            { id: "file", label: "File", submenu: fileItems },
            { id: "edit", label: "Edit", submenu: editItems },
            { id: "view", label: "View", submenu: viewItems },
            { id: "servers", label: "Servers", submenu: serverItems },
            {
                id: "window",
                label: "Window",
                nativeRole: "window",
                submenu: [
                    { label: "Close", accelerator: "CmdOrCtrl+W", nativeRole: "close", action: { type: "window-command", command: "close" } },
                    { label: "Minimize", accelerator: "CmdOrCtrl+M", nativeRole: "minimize", action: { type: "window-command", command: "minimize" } },
                    { label: "Zoom", nativeRole: "zoom" },
                    separator(),
                    { label: "Bring All to Front", nativeRole: "front" },
                ],
            },
            { id: "help", label: "Help", nativeRole: "help", submenu: helpItems },
        ]
    }

    return [
        {
            id: "file",
            label: "File",
            submenu: [
                ...fileItems,
                separator(),
                { label: "Settings", accelerator: "Ctrl+,", action: { type: "show-settings" } },
                separator(),
                { label: "Exit", nativeRole: "quit", action: { type: "quit" } },
            ],
        },
        { id: "edit", label: "Edit", submenu: editItems },
        { id: "view", label: "View", submenu: viewItems },
        { id: "servers", label: "Servers", submenu: serverItems },
        {
            id: "window",
            label: "Window",
            nativeRole: "window",
            submenu: [
                { label: "Minimize", accelerator: "CmdOrCtrl+M", nativeRole: "minimize", action: { type: "window-command", command: "minimize" } },
                { label: "Close", accelerator: "CmdOrCtrl+W", nativeRole: "close", action: { type: "window-command", command: "close" } },
            ],
        },
        { id: "help", label: "Help", nativeRole: "help", submenu: helpItems },
    ]
}

export class TitleMenuModel {
    private readonly listeners = new Set<(menu: TitleMenuItem[]) => void>()
    private readonly unsubscribeSources: Unsubscribe[]
    private menu: TitleMenuItem[]

    constructor(private state: Omit<TitleMenuState, "settings" | "session">, private readonly sources: TitleMenuSources) {
        this.menu = this.derive()
        this.unsubscribeSources = [
            sources.subscribeSettings(() => this.refresh()),
            sources.subscribeSession(() => this.refresh()),
        ]
    }

    getValue() {
        return this.menu
    }

    setState(state: Partial<Omit<TitleMenuState, "settings" | "session">>) {
        this.state = { ...this.state, ...state }
        this.refresh()
    }

    refresh() {
        this.menu = this.derive()
        this.listeners.forEach((listener) => listener(this.menu))
    }

    subscribe(listener: (menu: TitleMenuItem[]) => void): Unsubscribe {
        this.listeners.add(listener)
        listener(this.menu)
        return () => this.listeners.delete(listener)
    }

    dispose() {
        this.unsubscribeSources.forEach((unsubscribe) => unsubscribe())
        this.listeners.clear()
    }

    private derive() {
        return deriveTitleMenu({
            ...this.state,
            settings: this.sources.getSettings(),
            session: this.sources.getSession(),
        })
    }
}
