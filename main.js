var torrentApp = angular.module("torrentApp", ["ngResource", "ngAnimate", "ngTableResize", "infinite-scroll", "hc.marked", "xml-rpc"]);

// Register torrent clients
torrentApp.constant('$btclients', {
    'utorrent': {
        name: 'µTorrent',
        service: 'utorrentService',
        icon: 'utorrent'
    },
     'qbittorrent': {
        name: 'qBittorrent',
        service: 'qbittorrentService',
        icon: 'qbittorrent'
    },
    'transmission': {
        name: 'Transmission',
        service: 'transmissionService',
        icon: 'transmission'
    },
    'rtorrent': {
        name: 'rTorrent',
        service: 'rtorrentService',
        icon: 'rtorrent'
    }

});

// Configure the client
torrentApp.run(["$rootScope", "$bittorrent", "configService", function($rootScope, $bittorrent, config){
    config.initSettings();
    console.log("Settings", config.getAllSettings())
    $rootScope.$btclient = $bittorrent.getClient()
    $rootScope.$server = config.getDefaultServer()
    console.log("Btclient", $rootScope.$btclient)
}]);

// Set application menu
torrentApp.run(['menuWin', 'menuMac', 'electron', function(menuWin, menuMac, electron){
    var menu = null;

    if (process.platform === 'darwin') {
        menu = menuMac;
    } else {
        menu = menuWin;
    }

    var appMenu = electron.menu.buildFromTemplate(menu);
    electron.menu.setApplicationMenu(appMenu);
}]);
