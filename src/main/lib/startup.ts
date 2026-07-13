import { app } from 'electron'
import { spawn } from 'child_process'
import path from 'path'
import Q from 'q'
import electronRegedit from 'electron-regedit'

import type { SystemStartupOption } from '@shared/ipc-contract'
import { commandLineOptions, STARTED_AT_LOGIN_ARGUMENT, type SquirrelCommand } from './command-line'

const { ProgId, Regedit } = electronRegedit as any

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

function checkSquirrel(squirrelCommand?: SquirrelCommand) {
    if (process.platform !== 'win32') {
        return false
    }

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

const shouldQuitFromStartup = checkSquirrel(commandLineOptions.squirrelCommand)

export function configureSystemStartup(option: SystemStartupOption) {
    if (!app.isPackaged || !['darwin', 'win32'].includes(process.platform)) {
        return
    }

    const openAtLogin = option === 'open' || option === 'background'

    if (process.platform === 'win32') {
        const appFolder = path.dirname(process.execPath)
        const executableName = path.basename(process.execPath)
        const stubLauncher = path.resolve(appFolder, '..', executableName)

        app.setLoginItemSettings({
            openAtLogin,
            path: stubLauncher,
            args: openAtLogin ? [STARTED_AT_LOGIN_ARGUMENT] : [],
        })
        return
    }

    app.setLoginItemSettings({ openAtLogin })
}

export function shouldStartInBackground(option: SystemStartupOption, startedAtLogin: boolean) {
    if (option !== 'background') {
        return false
    }

    if (process.platform === 'win32') {
        return startedAtLogin
    }

    return process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin
}

export default shouldQuitFromStartup
