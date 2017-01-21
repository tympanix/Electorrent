const {ProgId, ShellOption, Regedit} = require('electron-regedit')

new ProgId({
    description: 'Torrent File',
    friendlyAppName: true,
    icon: 'resources/torrentfile.ico',
    squirrel: true,
    extensions: ['torrent']
})

module.exports = Regedit.squirrelStartupEvent()