import { app, Menu, type BrowserWindow, type MenuItemConstructorOptions } from "electron"

import { IPC_CHANNELS } from "@shared/ipc"
import type { TitleMenuAction, TitleMenuItem, TitleMenuPlatform } from "@shared/title-menu"
import { TitleMenuModel } from "@shared/title-menu"
import { bittorrentManager } from "./bittorrent"
import * as settings from "./settings"

let mainWindow: BrowserWindow | null = null
let isDebug = false
let model: TitleMenuModel | null = null

function getWindow() {
    return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}

function sendAction(action: TitleMenuAction) {
    const window = getWindow()
    if (!window) return
    window.webContents.send(IPC_CHANNELS.menu.action, action)
}

function runAction(action: TitleMenuAction, focusedWindow?: BrowserWindow) {
    const window = focusedWindow && !focusedWindow.isDestroyed() ? focusedWindow : getWindow()

    switch (action.type) {
        case "quit":
            app.quit()
            break
        case "edit-command":
            if (window) window.webContents[action.command]()
            break
        case "window-command":
            if (!window) return
            if (action.command === "reload") window.reload()
            if (action.command === "toggle-full-screen") window.setFullScreen(!window.isFullScreen())
            if (action.command === "toggle-dev-tools") window.webContents.toggleDevTools()
            if (action.command === "minimize") window.minimize()
            if (action.command === "close") window.close()
            break
        default:
            sendAction(action)
            break
    }
}

function toNativeMenuItem(item: TitleMenuItem): MenuItemConstructorOptions {
    if (item.type === "separator") return { type: "separator" }

    const nativeItem: MenuItemConstructorOptions = {
        id: item.id,
        label: item.label,
        accelerator: item.accelerator,
        type: item.type,
        checked: item.checked,
        enabled: item.enabled,
        visible: item.visible,
        role: item.nativeRole,
        submenu: item.submenu?.map(toNativeMenuItem),
    }

    if (!item.nativeRole && item.action) {
        nativeItem.click = (_menuItem, focusedWindow) => runAction(item.action!, focusedWindow as BrowserWindow | undefined)
    }

    return nativeItem
}

function render(menu: TitleMenuItem[]) {
    Menu.setApplicationMenu(Menu.buildFromTemplate(menu.map(toNativeMenuItem)))

    const window = getWindow()
    if (window) window.webContents.send(IPC_CHANNELS.menu.changed, menu)
}

function ensureModel() {
    if (model) return model

    model = new TitleMenuModel({
        appName: app.name,
        platform: process.platform as TitleMenuPlatform,
        isDebug,
    }, {
        getSettings: () => settings.getAllSettings(),
        subscribeSettings: (listener) => settings.subscribe(listener),
        getSession: () => bittorrentManager.getSessionState(getWindow()?.webContents),
        subscribeSession: (listener) => bittorrentManager.subscribe(listener),
    })
    model.subscribe(render)
    return model
}

export function setWindow(window: BrowserWindow) {
    mainWindow = window
    ensureModel().refresh()
}

export function configure(state: { isDebug: boolean }) {
    isDebug = state.isDebug
    ensureModel().setState({ isDebug })
}

export function getModel() {
    return ensureModel().getValue()
}

export function refresh() {
    ensureModel().refresh()
}
