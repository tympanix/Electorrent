var torrentApp = angular.module("torrentApp", ["ngResource", "ngAnimate", "ngTableResize", "infinite-scroll"]);

// Set application menu
torrentApp.run(['menuWin', 'menuMac', 'electron', function(menuWin, menuMac, electron){
    var menu = null;

    if (process.platform === 'darwin') {
        menu = menuMac;
    }
    else {
        menu = menuWin;
    }
    
    var appMenu = electron.menu.buildFromTemplate(menu);
    electron.menu.setApplicationMenu(appMenu);
}]);
