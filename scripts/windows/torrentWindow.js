var {remote} = require('electron')
var {Menu} = remote;
var {ipcRenderer} = require('electron');

var menu = Menu.buildFromTemplate([
    {
        label: 'Electorrent',
        submenu: [
            {
                label: 'Connect...',
                click: function(){
                    console.log("Connect clicked!");
                    ipcRenderer.send('show-connect')
                }
            }
        ]
    }
])
Menu.setApplicationMenu(menu);
