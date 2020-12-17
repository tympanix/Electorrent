// General browser dependencies
// declare global {
//     interface Window {
//         $: JQueryStatic;
//         jQuery: JQueryStatic;
//     }
// }
// import '../node_modules/jquery/dist/jquery.js'
// import "jquery-ui"
// import "fomantic-ui"
// import "marked"
// import "base64-js"

// // AngularJS front-end framework
// import * as angular from "angular"

// // AngularJS dependency modules
// import "angular-resource"
// import "angular-animate"
// import "ng-infinite-scroll"
// import "angular-table-resize"
// import "angular-marked"
// import "angular-ui-sortable"

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

// Controllers
import "./scripts/controllers/main"
import "./scripts/controllers/theme"
import "./scripts/controllers/torrents"
import "./scripts/controllers/settings"
import "./scripts/controllers/welcome"
import "./scripts/controllers/notifications"

// Services
import "./scripts/services/httpFormService"
import "./scripts/services/bittorrent"
import "./scripts/services/electron"
import "./scripts/services/config"
import "./scripts/services/notification"
import "./scripts/services/server"
import "./scripts/services/column"
import "./scripts/services/remote"

// Bittorrent
import "./scripts/bittorrent/abstracttorrent"
import "./scripts/bittorrent/qbittorrent/qbittorrentservice"
import "./scripts/bittorrent/qbittorrent/torrentq"
import "./scripts/bittorrent/utorrent/utorrentservice"
import "./scripts/bittorrent/utorrent/torrentu"
import "./scripts/bittorrent/transmission/transmissionservice"
import "./scripts/bittorrent/transmission/torrentt"
import "./scripts/bittorrent/transmission/transmissionconfig"
import "./scripts/bittorrent/rtorrent/rtorrentservice"
import "./scripts/bittorrent/rtorrent/torrentr"
import "./scripts/bittorrent/synology/synologyservice"
import "./scripts/bittorrent/synology/synologytorrent"
import "./scripts/bittorrent/deluge/delugeservice"
import "./scripts/bittorrent/deluge/torrentd"

// Filters
import "./scripts/filters/dateFilter"
import "./scripts/filters/bytes"
import "./scripts/filters/torrentfilters"

// Directives
import "./scripts/directives/progress"
import "./scripts/directives/rightclick"
import "./scripts/directives/contextmenu"
import "./scripts/directives/dropdown"
import "./scripts/directives/readyBroadcast"
import "./scripts/directives/checkbox"
import "./scripts/directives/repeatdone"
import "./scripts/directives/modal"
import "./scripts/directives/actionheader"
import "./scripts/directives/labelsdropdown"
import "./scripts/directives/draganddrop"
import "./scripts/directives/sorting"
import "./scripts/directives/drop"
import "./scripts/directives/torrenttable"
import "./scripts/directives/search"
import "./scripts/directives/fixedheader"
import "./scripts/directives/time"
import "./scripts/directives/limit"

// Components
import "./scripts/components/menuWin"
import "./scripts/components/menuMac"
