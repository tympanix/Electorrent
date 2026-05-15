import { app, type BrowserWindow } from 'electron'

let mainWindow: BrowserWindow | null = null

export function setWindow(newWindow: BrowserWindow) {
    mainWindow = newWindow
}

export function getWindow() {
    return mainWindow
}

export function isDevelopment() {
    try {
        if (app.isPackaged) {
            return false
        }
        return Number.parseInt(process.env.ELECTRON_IS_DEV || '0', 10) === 1
    } catch (_e) {
        return false
    }
}
