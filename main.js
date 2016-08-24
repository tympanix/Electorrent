var torrentApp = angular.module("torrentApp", ["ngResource", "ngAnimate", "ngTableResize", "infinite-scroll", "hc.marked"]);

// Register torrent clients
torrentApp.constant('clients', {
    'utorrent': {
        name: 'µTorrent',
        service: 'utorrentService',
        icon: 'icon torrent uTorrent',
    },
     'qbittorrent': {
        name: 'qBittorrent',
        service: 'qbittorrentService',
        icon: 'icon torrent qBittorrent'
    }
});

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

torrentApp.run(["$rootScope", "$bittorrent", function($rootScope, $bittorrent){
    $rootScope.$btclient = $bittorrent.getClient();
}]);