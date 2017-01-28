const {ProgId, ShellOption, Regedit} = require('electron-regedit')
const {app} = require('electron')
const path = require('path')
const {spawn} = require('child_process')
const Q = require('q')

new ProgId({
    description: 'Torrent File',
    friendlyAppName: true,
    icon: 'resources/torrentfile.ico',
    squirrel: true,
    extensions: ['torrent']
})

function executeSquirrelCommand(args) {
    let defer = Q.defer()
    var updateDotExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
    var child = spawn(updateDotExe, args, { detached: true });
    child.on('close', function(code) {
        if (code === 0) {
            defer.resolve(code)
        } else {
            defer.reject(code)
        }
   });
   return defer.promise
}

function makeShortcut() {
    var target = path.basename(process.execPath);
    return executeSquirrelCommand(["--createShortcut", target]);
}

function removeShortcut() {
    var target = path.basename(process.execPath);
    return executeSquirrelCommand(["--removeShortcut", target]);
}

function checkSquirrel() {
    if (process.platform !== 'win32') {
        return false;
    }

    var squirrelCommand = process.argv[1];
    switch (squirrelCommand) {
        case '--squirrel-install':
        case '--squirrel-updated':
            Q.all([
                Regedit.installAll(),
                makeShortcut()
            ]).finally(() => app.quit())
            return true;
        case '--squirrel-uninstall':
            Q.all([
                Regedit.uninstallAll(),
                removeShortcut()
            ]).finally(() => app.quit())
            return true;
        case '--squirrel-obsolete':
            app.quit();
            return true;
    }
}

module.exports = checkSquirrel()