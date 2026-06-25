import { app, Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'

import { CLIENT_METADATA } from '@shared/client-metadata'
import { IPC_CHANNELS } from '@shared/ipc'
import type { AppSettings, StoredServerConfig } from '@shared/ipc-contract'
import * as settings from './settings'

type MenuSessionState = {
    isDebug: boolean
    activeServerId: string | null
    activeClientId: string | null
}

let mainWindow: BrowserWindow | null = null
let menuState: MenuSessionState = {
    isDebug: false,
    activeServerId: null,
    activeClientId: null,
}
const defaultMenuSettings: AppSettings = settings.getDefaultSettings()
let menuSettings: AppSettings = defaultMenuSettings

function normalizeMenuSettings(settingsValue: Partial<AppSettings> | null | undefined): AppSettings {
    return {
        ...defaultMenuSettings,
        ...settingsValue,
        ui: {
            ...defaultMenuSettings.ui,
            ...(settingsValue?.ui || {}),
        },
        servers: Array.isArray(settingsValue?.servers) ? settingsValue.servers : [],
    }
}

export function setWindow(window: BrowserWindow) {
    mainWindow = window
    buildMenu()
}

function sendAction(action: unknown) {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.send(IPC_CHANNELS.menu.action, action)
}

function serverAccelerator(index: number) {
    if (index > 0 && index <= 10) {
        return `CmdOrCtrl+${index % 10}`
    }

    return undefined
}

function getServerLabel(server: StoredServerConfig) {
    const clientName = CLIENT_METADATA[server.client]?.name || server.client || 'Server'
    const address = server.ip || 'unknown host'
    return server.name || `${clientName} @ ${address}`
}

function hasActiveServer() {
    return !!menuState.activeServerId
}

function advancedUploadEnabled() {
    return !!menuState.activeClientId && !!CLIENT_METADATA[menuState.activeClientId]?.showAdvancedUploadMenu
}

function serverMenuItems(): MenuItemConstructorOptions[] {
    const submenu: MenuItemConstructorOptions[] = [
        {
            label: 'Add new server...',
            accelerator: 'CmdOrCtrl+N',
            click: () => sendAction({ type: 'add-server' }),
        },
        {
            label: 'Set current as default',
            enabled: hasActiveServer(),
            click: () => sendAction({ type: 'set-current-default-server' }),
        },
        { type: 'separator' },
    ]

    if (!menuSettings.servers.length) {
        submenu.push({
            label: 'No servers',
            enabled: false,
        })
        return submenu
    }

    menuSettings.servers.forEach((server, index) => {
        submenu.push({
            label: getServerLabel(server),
            accelerator: serverAccelerator(index + 1),
            type: 'radio',
            checked: server.id === menuState.activeServerId,
            click: () => sendAction({ type: 'connect-server', serverId: server.id }),
        })
    })

    return submenu
}

function fileMenuItems(): MenuItemConstructorOptions[] {
    return [
        {
            label: 'Add Torrent',
            accelerator: 'CmdOrCtrl+O',
            click: () => sendAction({ type: 'open-add-torrent', askUploadOptions: false }),
        },
        {
            label: 'Add Torrent (Advanced)',
            accelerator: process.platform === 'darwin' ? 'CmdOrCtrl+Alt+O' : 'CmdOrCtrl+Shift+O',
            visible: advancedUploadEnabled(),
            enabled: advancedUploadEnabled(),
            click: () => sendAction({ type: 'open-add-torrent', askUploadOptions: true }),
        },
        {
            label: 'Paste Torrent URL',
            accelerator: 'CmdOrCtrl+I',
            click: () => sendAction({ type: 'paste-torrent-url', askUploadOptions: false }),
        },
        {
            label: 'Paste Torrent URL (Advanced)',
            accelerator: process.platform === 'darwin' ? 'CmdOrCtrl+Alt+I' : 'CmdOrCtrl+Shift+I',
            visible: advancedUploadEnabled(),
            enabled: advancedUploadEnabled(),
            click: () => sendAction({ type: 'paste-torrent-url', askUploadOptions: true }),
        },
    ]
}

function editMenuItems(): MenuItemConstructorOptions[] {
    return [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        {
            label: 'Find',
            accelerator: 'CmdOrCtrl+F',
            click: () => sendAction({ type: 'search-torrent' }),
        },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        {
            label: 'Remove',
            accelerator: 'Delete',
            click: () => sendAction({ type: 'remove-selected' }),
        },
        {
            label: 'Select All',
            accelerator: 'CmdOrCtrl+A',
            click: () => sendAction({ type: 'select-all' }),
        },
    ]
}

function viewMenuItems(): MenuItemConstructorOptions[] {
    return [
        {
            label: 'Reload',
            visible: !!menuState.isDebug,
            accelerator: 'CmdOrCtrl+R',
            click(_item, focusedWindow) {
                if (focusedWindow) (focusedWindow as BrowserWindow).reload()
            },
        },
        {
            label: 'Toggle Full Screen',
            accelerator: process.platform === 'darwin' ? 'Ctrl+Command+F' : 'F11',
            click(_item, focusedWindow) {
                if (focusedWindow) {
                    const browserWindow = focusedWindow as BrowserWindow
                    browserWindow.setFullScreen(!browserWindow.isFullScreen())
                }
            },
        },
        {
            label: 'Toggle Developer Tools',
            visible: !!menuState.isDebug,
            accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
            click(_item, focusedWindow) {
                if (focusedWindow) {
                    (focusedWindow as BrowserWindow).webContents.toggleDevTools()
                }
            },
        },
    ]
}

function helpMenuItems(): MenuItemConstructorOptions[] {
    return [
        {
            label: 'Learn More',
            click: () => sendAction({ type: 'open-external', url: 'https://github.com/tympanix/Electorrent' }),
        },
        {
            label: 'Check For Updates',
            click: () => sendAction({ type: 'check-for-updates', verbose: true }),
        },
    ]
}

function buildDarwinTemplate(): MenuItemConstructorOptions[] {
    const name = app.name

    return [
        {
            label: name,
            submenu: [
                { label: `About ${name}`, role: 'about' },
                { type: 'separator' },
                {
                    label: 'Preferences',
                    accelerator: 'Command+,',
                    click: () => sendAction({ type: 'show-settings' }),
                },
                { label: 'Services', role: 'services', submenu: [] },
                { type: 'separator' },
                { label: `Hide ${name}`, accelerator: 'Command+H', role: 'hide' },
                { label: 'Hide Others', accelerator: 'Command+Alt+H', role: 'hideOthers' },
                { label: 'Show All', role: 'unhide' },
                { type: 'separator' },
                { label: 'Quit', accelerator: 'Command+Q', role: 'quit' },
            ],
        },
        {
            label: 'File',
            id: 'file',
            submenu: fileMenuItems(),
        },
        {
            label: 'Edit',
            submenu: editMenuItems(),
        },
        {
            label: 'View',
            submenu: viewMenuItems(),
        },
        {
            label: 'Servers',
            id: 'servers',
            submenu: serverMenuItems(),
        },
        {
            label: 'Window',
            role: 'window',
            submenu: [
                { label: 'Close', accelerator: 'CmdOrCtrl+W', role: 'close' },
                { label: 'Minimize', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
                { label: 'Zoom', role: 'zoom' },
                { type: 'separator' },
                { label: 'Bring All to Front', role: 'front' },
            ],
        },
        {
            label: 'Help',
            role: 'help',
            submenu: helpMenuItems(),
        },
    ]
}

function buildDefaultTemplate(): MenuItemConstructorOptions[] {
    return [
        {
            label: 'File',
            id: 'file',
            submenu: [
                ...fileMenuItems(),
                { type: 'separator' },
                {
                    label: 'Settings',
                    accelerator: 'Ctrl+,',
                    click: () => sendAction({ type: 'show-settings' }),
                },
                { type: 'separator' },
                { label: 'Exit', role: 'quit' },
            ],
        },
        {
            label: 'Edit',
            submenu: editMenuItems(),
        },
        {
            label: 'View',
            submenu: viewMenuItems(),
        },
        {
            label: 'Servers',
            id: 'servers',
            submenu: serverMenuItems(),
        },
        {
            label: 'Window',
            role: 'window',
            submenu: [
                { label: 'Minimize', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
                { label: 'Close', accelerator: 'CmdOrCtrl+W', role: 'close' },
            ],
        },
        {
            label: 'Help',
            role: 'help',
            submenu: helpMenuItems(),
        },
    ]
}

function buildMenu() {
    const template = process.platform === 'darwin'
        ? buildDarwinTemplate()
        : buildDefaultTemplate()

    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

export function configure(state: Pick<MenuSessionState, 'isDebug'>) {
    menuState = Object.assign({}, menuState, state)
    refresh()
}

export function setActiveServer(server?: { id?: string | null; client?: string | null } | null) {
    menuState = Object.assign({}, menuState, {
        activeServerId: server?.id || null,
        activeClientId: server?.client || null,
    })
    buildMenu()
}

export function refresh() {
    menuSettings = normalizeMenuSettings(settings.getAllSettings())
    buildMenu()
}
