
export let menuMac = ['electron', '$rootScope', '$bittorrent', function(electron, $rootScope, $bittorrent) {
    const name = electron.app.name;

    const template = [
        {
            label: name,
            submenu: [
                {
                    label: 'About ' + name,
                    role: 'about'
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Preferences',
                    accelerator: 'Command+,',
                    click: function() {
                        $rootScope.$broadcast('show:settings');
                    }
                },
                {
                    label: 'Services',
                    role: 'services',
                    submenu: []
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Hide ' + name,
                    accelerator: 'Command+H',
                    role: 'hide'
                },
                {
                    label: 'Hide Others',
                    accelerator: 'Command+Alt+H',
                    role: 'hideothers'
                },
                {
                    label: 'Show All',
                    role: 'unhide'
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Quit',
                    accelerator: 'Command+Q',
                    click() { electron.app.quit(); }
                },
            ]
        },
        {
            label: 'File',
            id: 'file',
            submenu: [
                {
                    label: "Add Torrent",
                    accelerator: "CmdOrCtrl+O",
                    click: function() {
                        electron.torrents.browse(false);
                    }
                },
                {
                    label: "Add Torrent (Advanced)",
                    id: "torrent-file-add-advanced",
                    accelerator: "CmdOrCtrl+Alt+O",
                    visible: false,
                    enabled: false,
                    click: function() {
                        electron.torrents.browse(true);
                    }
                },
                {
                    label: "Paste Torrent URL",
                    accelerator: "CmdOrCtrl+I",
                    click: function() {
                        $bittorrent.uploadFromClipboard();
                    }
                },
                {
                    label: "Paste Torrent URL (Advanced)",
                    accelerator: "CmdOrCtrl+Alt+I",
                    id: "torrent-url-add-advanced",
                    visible: false,
                    click: function() {
                        $bittorrent.uploadFromClipboard(true);
                    }
                },
            ]
        },
        {
            label: 'Edit',
            submenu: [
                {
                    label: 'Undo',
                    accelerator: 'CmdOrCtrl+Z',
                    role: 'undo'
                },
                {
                    label: 'Redo',
                    accelerator: 'Shift+CmdOrCtrl+Z',
                    role: 'redo'
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Find',
                    accelerator: 'CmdOrCtrl+F',
                    click() {
                        $rootScope.$broadcast('search:torrent');
                    }
                },
                {
                    label: 'Cut',
                    accelerator: 'CmdOrCtrl+X',
                    role: 'cut'
                },
                {
                    label: 'Copy',
                    accelerator: 'CmdOrCtrl+C',
                    role: 'copy'
                },
                {
                    label: 'Paste',
                    accelerator: 'CmdOrCtrl+V',
                    role: 'paste'
                },
                {
                    label: 'Remove',
                    accelerator: 'Delete',
                    click() {
                        if (document.activeElement.nodeName !== 'INPUT') {
                            $rootScope.$broadcast('menu:remove')
                        }
                    }
                },
                {
                    label: 'Select All',
                    accelerator: 'CmdOrCtrl+A',
                    click() {
                        if (document.activeElement.nodeName === 'INPUT') {
                            electron.remote.getCurrentWebContents().selectAll()
                        } else {
                            $rootScope.$broadcast('menu:selectall')
                        }
                    },
                },
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Reload',
                    visible: electron.program.debug,
                    accelerator: 'CmdOrCtrl+R',
                    click(item, focusedWindow) {
                        if (focusedWindow) focusedWindow.reload();
                    }
                },
                {
                    label: 'Toggle Full Screen',
                    accelerator: process.platform === 'darwin' ? 'Ctrl+Command+F' : 'F11',
                    click(item, focusedWindow) {
                        if (focusedWindow)
                        focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
                    }
                },
                {
                    label: 'Toggle Developer Tools',
                    visible: electron.program.debug,
                    accelerator: 'Alt+Command+I',
                    click(item, focusedWindow) {
                        if (focusedWindow)
                        focusedWindow.webContents.toggleDevTools();
                    }
                },
            ]
        },
        {
            label: 'Servers',
            id: 'servers',
            submenu: []
        },
        {
            label: 'Window',
            role: 'window',
            submenu: [
                {
                    label: 'Close',
                    accelerator: 'CmdOrCtrl+W',
                    role: 'close'
                },
                {
                    label: 'Minimize',
                    accelerator: 'CmdOrCtrl+M',
                    role: 'minimize'
                },
                {
                    label: 'Zoom',
                    role: 'zoom'
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Bring All to Front',
                    role: 'front'
                }
            ]
        },
        {
            label: 'Help',
            role: 'help',
            submenu: [
                {
                    label: 'Learn More',
                    click() { electron.shell.openExternal('https://github.com/tympanix/Electorrent'); }
                },
                {
                    label: 'Check For Updates',
                    click() { electron.updater.checkForUpdates(true) }
                }
            ]
        },
    ];

    return template;

}]

