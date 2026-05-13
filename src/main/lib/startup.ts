import { app } from 'electron'

const { ProgId, Regedit } = require('electron-regedit')
const path = require('path')
const { spawn } = require('child_process')
const Q = require('q')

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

module.exports = checkSquirrel()
