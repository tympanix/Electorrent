import { app, Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc'
import type { AppSettings, MenuAction, StoredServerConfig, WindowCommand } from '@shared/ipc-contract'
import {
    buildMenuModel,
    type MenuCommand,
    type MenuModelItem,
    type MenuModelMenu,
} from '@shared/menu-model'
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

function sendAction(action: MenuAction) {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.send(IPC_CHANNELS.menu.action, action)
}

function runWindowCommand(window: BrowserWindow, command: WindowCommand) {
    switch (command) {
        case 'reload':
            window.reload()
            break
        case 'toggle-full-screen':
            window.setFullScreen(!window.isFullScreen())
            break
        case 'toggle-dev-tools':
            window.webContents.toggleDevTools()
            break
        case 'minimize':
            window.minimize()
            break
        case 'close':
            window.close()
            break
        default:
            break
    }
}

function applyMenuCommand(options: MenuItemConstructorOptions, command: MenuCommand) {
    switch (command.type) {
        case 'menu-action':
            options.click = () => sendAction(command.action)
            break
        case 'edit-command':
            options.role = command.command as MenuItemConstructorOptions['role']
            break
        case 'window-command':
            if (command.command === 'minimize' || command.command === 'close') {
                options.role = command.command as MenuItemConstructorOptions['role']
            } else {
                options.click = (_item, focusedWindow) => {
                    if (focusedWindow) {
                        runWindowCommand(focusedWindow as BrowserWindow, command.command)
                    }
                }
            }
            break
        case 'app-command':
            if (command.command === 'quit') {
                options.role = 'quit'
            }
            break
        default:
            break
    }
}

function toElectronMenuItem(item: MenuModelItem): MenuItemConstructorOptions {
    if (item.separator) {
        return { type: 'separator' }
    }

    const options: MenuItemConstructorOptions = {}

    if (item.id) options.id = item.id
    if (item.label) options.label = item.label
    if (item.accelerator) options.accelerator = item.accelerator
    if (item.type) options.type = item.type
    if (typeof item.checked === 'boolean') options.checked = item.checked
    if (typeof item.enabled === 'boolean') options.enabled = item.enabled
    if (typeof item.visible === 'boolean') options.visible = item.visible
    if (item.role) options.role = item.role as MenuItemConstructorOptions['role']
    if (item.submenu) options.submenu = item.submenu.map(toElectronMenuItem)
    if (item.command) applyMenuCommand(options, item.command)

    return options
}

function toElectronMenu(menu: MenuModelMenu): MenuItemConstructorOptions {
    return toElectronMenuItem({
        id: menu.id,
        label: menu.label,
        role: menu.role,
        submenu: menu.items,
    })
}

function buildMenu() {
    const model = buildMenuModel({
        layout: process.platform === 'darwin' ? 'darwin' : 'standard',
        acceleratorStyle: 'electron',
        appName: app.name,
        isDebug: menuState.isDebug,
        activeServerId: menuState.activeServerId,
        activeClientId: menuState.activeClientId,
        servers: menuSettings.servers as StoredServerConfig[],
    })

    Menu.setApplicationMenu(Menu.buildFromTemplate(model.menus.map(toElectronMenu)))
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
