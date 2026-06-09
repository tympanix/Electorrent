import { app } from 'electron'
import { spawn } from 'child_process'
import path from 'path'
import Q from 'q'
import electronRegedit from 'electron-regedit'

import type { SystemStartupOption } from '@shared/ipc-contract'

const { ProgId, Regedit } = electronRegedit as any
const STARTED_AT_LOGIN_ARG = '--started-at-login'

new ProgId({
    description: 'Torrent File',
    friendlyAppName: true,
    icon: 'resources/torrentfile.ico',
    squirrel: true,
    extensions: ['torrent'],
})

function executeSquirrelCommand(args: string[]) {
    const defer = Q.defer()
    const updateDotExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe')
    const child = spawn(updateDotExe, args, { detached: true })
    child.on('close', function(code: number) {
        if (code === 0) {
            defer.resolve(code)
        } else {
            defer.reject(code)
        }
    })
    return defer.promise
}

function makeShortcut() {
    const target = path.basename(process.execPath)
    return executeSquirrelCommand(['--createShortcut', target])
}

function removeShortcut() {
    const target = path.basename(process.execPath)
    return executeSquirrelCommand(['--removeShortcut', target])
}

function checkSquirrel() {
    if (process.platform !== 'win32') {
        return false
    }

    const squirrelCommand = process.argv[1]
    switch (squirrelCommand) {
        case '--squirrel-install':
        case '--squirrel-updated':
            Q.all([
                Regedit.installAll(),
                makeShortcut(),
            ]).finally(() => app.quit())
            return true
        case '--squirrel-uninstall':
            Q.all([
                Regedit.uninstallAll(),
                removeShortcut(),
            ]).finally(() => app.quit())
            return true
        case '--squirrel-obsolete':
            app.quit()
            return true
        default:
            return false
    }
}

const shouldQuitFromStartup = checkSquirrel()

export function configureSystemStartup(option: SystemStartupOption) {
    if (!app.isPackaged || !['darwin', 'win32'].includes(process.platform)) {
        return
    }

    const openAtLogin = option === 'open' || option === 'minimized'

    if (process.platform === 'win32') {
        const appFolder = path.dirname(process.execPath)
        const executableName = path.basename(process.execPath)
        const stubLauncher = path.resolve(appFolder, '..', executableName)

        app.setLoginItemSettings({
            openAtLogin,
            path: stubLauncher,
            args: openAtLogin ? [STARTED_AT_LOGIN_ARG] : [],
        })
        return
    }

    app.setLoginItemSettings({ openAtLogin })
}

export function shouldStartMinimized(option: SystemStartupOption) {
    if (option !== 'minimized') {
        return false
    }

    if (process.platform === 'win32') {
        return process.argv.includes(STARTED_AT_LOGIN_ARG)
    }

    return process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin
}

export default shouldQuitFromStartup
