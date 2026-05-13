import { app, type BrowserWindow } from 'electron'

let mainWindow: BrowserWindow | null

exports.setWindow = function(newWindow: BrowserWindow) {
    mainWindow = newWindow
}

exports.getWindow = function() {
    return mainWindow
}

exports.isDevelopment = function() {
    try {
        if (app.isPackaged) {
            return false
        }
        return Number.parseInt(process.env.ELECTRON_IS_DEV || '0', 10) === 1
    } catch (_e) {
        return false
    }
}
