var torrentApp = angular.module("torrentApp", ["ngResource", "ngAnimate", "rzTable", "infinite-scroll", "hc.marked", "ui.sortable"]);

// Configure the application
torrentApp.config(['$animateProvider', function($animateProvider) {
        $animateProvider.classNameFilter(/\banimated\b|\btransition\b/);
    }
]);

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
    },
    'synology': {
        name: 'Synology Download Station',
        service: 'synologyService',
        icon: 'downloadstation'
    },
    'deluge': {
        name: 'Deluge',
        service: 'delugeService',
        icon: 'deluge',
    }

});

// Configure the client
torrentApp.run(["electron", "configService", function(electron, config){
    try {
        config.initSettings();
    } catch {
        electron.ipc.send('settings:corrupt')
    }
}]);

// Set application menu
torrentApp.run(['menuWin', 'menuMac', 'electron', 'configService', function(menuWin, menuMac, electron, config){
    var menuTemplate = null;

    if (electron.is.macOS()) {
        menuTemplate = menuMac;
    } else {
        menuTemplate = menuWin;
    }

    var appMenu = electron.menu.buildFromTemplate(menuTemplate);
    electron.menu.setApplicationMenu(appMenu);
    config.renderServerMenu()
}]);
