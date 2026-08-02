import { app, BrowserWindow, ipcMain, screen, type IpcMainInvokeEvent } from 'electron'
import path from 'path'

import { IPC_CHANNELS } from '@shared/ipc'
import type { ContextMenuModel, ContextMenuSize } from '@shared/ipc-contract'

const MINIMUM_SIZE = 1
const MENU_WINDOW_MARGIN = 12

export function registerContextMenuHandlers(getWindow: () => BrowserWindow | null) {
    let menuWindow: BrowserWindow | null = null
    let parentWindow: BrowserWindow | null = null
    let parentModel: ContextMenuModel | null = null

    const closeMenu = () => {
        const window = menuWindow
        menuWindow = null
        parentWindow = null
        parentModel = null

        if (window && !window.isDestroyed()) {
            window.close()
        }
    }

    const isMenuSender = (event: IpcMainInvokeEvent) => {
        return !!menuWindow && !menuWindow.isDestroyed() && event.sender === menuWindow.webContents
    }

    ipcMain.handle(IPC_CHANNELS.contextMenu.show, async function(event: IpcMainInvokeEvent, model: ContextMenuModel) {
        closeMenu()

        const requestedParent = BrowserWindow.fromWebContents(event.sender)
        const fallbackParent = getWindow()
        const parent = requestedParent && !requestedParent.isDestroyed() ? requestedParent : fallbackParent
        if (!parent || parent.isDestroyed()) {
            return
        }

        parentWindow = parent
        parentModel = model
        const child = new BrowserWindow({
            show: false,
            width: MINIMUM_SIZE,
            height: MINIMUM_SIZE,
            frame: false,
            transparent: true,
            focusable: true,
            hasShadow: false,
            resizable: false,
            movable: false,
            minimizable: false,
            maximizable: false,
            fullscreenable: false,
            skipTaskbar: true,
            parent,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                preload: path.join(__dirname, 'context-menu-preload.js'),
            },
        })
        menuWindow = child

        const closeIfCurrent = () => {
            if (menuWindow === child) {
                closeMenu()
            }
        }
        child.once('blur', closeIfCurrent)

        child.once('closed', () => {
            if (menuWindow === child) {
                menuWindow = null
                parentWindow = null
                parentModel = null
            }
        })
        child.webContents.once('did-finish-load', () => {
            if (menuWindow === child && !child.isDestroyed()) {
                child.webContents.send(IPC_CHANNELS.contextMenu.model, model)
            }
        })
        await child.loadFile(path.join(__dirname, 'context-menu.html'))
    })

    ipcMain.handle(IPC_CHANNELS.contextMenu.hide, async function(event: IpcMainInvokeEvent) {
        if ((parentWindow && event.sender === parentWindow.webContents) || isMenuSender(event)) {
            closeMenu()
        }
    })

    ipcMain.handle(IPC_CHANNELS.contextMenu.resize, async function(event: IpcMainInvokeEvent, size: ContextMenuSize) {
        if (!isMenuSender(event) || !menuWindow || !parentWindow || !parentModel) {
            return
        }

        const contentBounds = parentWindow.getContentBounds()
        const anchor = {
            x: Math.round(contentBounds.x + parentModel.x),
            y: Math.round(contentBounds.y + parentModel.y),
        }
        const display = screen.getDisplayNearestPoint(anchor)
        const width = Math.max(MINIMUM_SIZE, Math.min(Math.ceil(size.width), display.workArea.width))
        const height = Math.max(MINIMUM_SIZE, Math.min(Math.ceil(size.height), display.workArea.height))
        const right = display.workArea.x + display.workArea.width
        const bottom = display.workArea.y + display.workArea.height
        const submenuOnLeft = anchor.x - MENU_WINDOW_MARGIN + width > right
        const x = Math.max(display.workArea.x, Math.min(submenuOnLeft ? anchor.x + MENU_WINDOW_MARGIN - width : anchor.x - MENU_WINDOW_MARGIN, right - width))
        const y = Math.max(display.workArea.y, Math.min(anchor.y - MENU_WINDOW_MARGIN + height > bottom ? anchor.y + MENU_WINDOW_MARGIN - height : anchor.y - MENU_WINDOW_MARGIN, bottom - height))

        menuWindow.setBounds({ x, y, width, height })
        if (!app.commandLine.hasSwitch('headless')) {
            menuWindow.show()
        }
        return { submenuOnLeft }
    })

    ipcMain.handle(IPC_CHANNELS.contextMenu.select, async function(event: IpcMainInvokeEvent, { actionId }: { actionId: string }) {
        if (!isMenuSender(event) || !parentWindow || parentWindow.isDestroyed()) {
            return
        }

        const target = parentWindow
        closeMenu()
        target.webContents.send(IPC_CHANNELS.contextMenu.action, actionId)
    })
}
