var torrentApp = angular.module("torrentApp", ["ngResource", "ngAnimate", "infinite-scroll"]);

// Set application menu
torrentApp.run(['menu', 'electron', function(menu, electron){
    var appMenu = electron.menu.buildFromTemplate(menu);
    electron.menu.setApplicationMenu(appMenu);
}]);
