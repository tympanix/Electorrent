// declare global {
//     const angular: ng.IAngularStatic;
// }

// Import all client implementations
import {
    UtorrentClient,
    QBittorrentClient,
    TransmissionClient,
    RtorrentClient,
    SynologyClient,
    DelugeClient
} from "./scripts/bittorrent"

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
        service: new UtorrentClient(),
        icon: 'utorrent'
    },
     'qbittorrent': {
        name: 'qBittorrent',
        service: new QBittorrentClient(),
        icon: 'qbittorrent'
    },
    'transmission': {
        name: 'Transmission',
        service: new TransmissionClient(),
        icon: 'transmission'
    },
    'rtorrent': {
        name: 'rTorrent',
        service: new RtorrentClient(),
        icon: 'rtorrent'
    },
    'synology': {
        name: 'Synology Download Station',
        service: new SynologyClient(),
        icon: 'downloadstation'
    },
    'deluge': {
        name: 'Deluge',
        service: new DelugeClient(),
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
    config.updateApplicationMenu()
}]);

// Controllers
import { mainController } from "./scripts/controllers/main"
torrentApp.controller("mainController", mainController)
import {themeController} from "./scripts/controllers/theme"
torrentApp.controller("themeController", themeController)
import {torrentsController} from "./scripts/controllers/torrents"
torrentApp.controller("torrentsController", torrentsController)
import {settingsController} from "./scripts/controllers/settings"
torrentApp.controller("settingsController", settingsController)
import {welcomeController} from "./scripts/controllers/welcome"
torrentApp.controller("welcomeController", welcomeController)
import {notificationsController} from "./scripts/controllers/notifications"
torrentApp.controller("notificationsController", notificationsController)

// Services
import { httpFormService } from "./scripts/services/httpFormService"
torrentApp.factory("httpFormService", httpFormService)
import { bittorrentService } from "./scripts/services/bittorrent"
torrentApp.service("$bittorrent", bittorrentService)
import { electronService } from "./scripts/services/electron"
torrentApp.service("electron", electronService)
import { configService } from "./scripts/services/config"
torrentApp.service("configService", configService)
import { notificationService } from "./scripts/services/notification"
torrentApp.service("notificationService", notificationService)
import { serverService} from "./scripts/services/server"
torrentApp.factory("Server", serverService)
import { remoteService } from "./scripts/services/remote"
torrentApp.factory("$remote", remoteService)

// Filters
import {dateFilter, etaFilter, releaseDateFilter} from "./scripts/filters/dateFilter"
torrentApp.filter('date', dateFilter)
torrentApp.filter('eta', etaFilter)
torrentApp.filter('releaseDate', releaseDateFilter)
import {bytesFilter, speedFilter} from "./scripts/filters/bytes"
torrentApp.filter('bytes', bytesFilter)
torrentApp.filter('speed', speedFilter)
import {torrentQueueFilter, torrentRatioFilter, torrentTrackerFilter} from "./scripts/filters/torrentfilters"
torrentApp.filter('torrentQueue', torrentQueueFilter)
torrentApp.filter('torrentRatio', torrentRatioFilter)
torrentApp.filter('torrentTracker', torrentTrackerFilter)

// Directives
import {progress} from "./scripts/directives/progress"
torrentApp.directive('progress', progress)
import {ngRightClick} from "./scripts/directives/rightclick"
torrentApp.directive('ngRightClick', ngRightClick)
import {contextMenu} from "./scripts/directives/contextmenu"
torrentApp.directive("contextMenu", contextMenu)
import {dropdown, dropItem} from "./scripts/directives/dropdown"
torrentApp.directive("dropdown", dropdown)
torrentApp.directive('dropItem', dropItem)
import {readyBroadcast} from "./scripts/directives/readyBroadcast"
torrentApp.directive("readyBroadcast", readyBroadcast)
import {toggleController, toggle} from "./scripts/directives/checkbox"
torrentApp.controller('toggleController', toggleController)
torrentApp.directive('toggle', toggle)
import {repeatDone} from "./scripts/directives/repeatdone"
torrentApp.directive("repeatDone", repeatDone)
import {modal} from "./scripts/directives/modal"
torrentApp.directive("modal", modal)
import {actionHeader} from "./scripts/directives/actionheader"
torrentApp.directive("actionHeader", actionHeader)
import {labelsDropdown} from "./scripts/directives/labelsdropdown"
torrentApp.directive("labelsDropdown", labelsDropdown)
import {dragAndDrop} from "./scripts/directives/draganddrop"
torrentApp.directive("dragAndDrop", dragAndDrop)
import {sorting, sort} from "./scripts/directives/sorting"
torrentApp.directive("sorting", sorting)
torrentApp.directive('sort', sort)
import {dropDownController, dropdown as dropdownDirective, dropdownGroup} from "./scripts/directives/drop"
torrentApp.controller("DropDownController", dropDownController)
torrentApp.directive('dropdown', dropdownDirective)
torrentApp.directive('dropdownGroup', dropdownGroup)
import {torrentBody, torrentRow} from "./scripts/directives/torrenttable"
torrentApp.directive("torrentBody", torrentBody)
torrentApp.directive('torrentRow', torrentRow)
import {search} from "./scripts/directives/search"
torrentApp.directive("search", search)
import {time} from "./scripts/directives/time"
torrentApp.directive("time", time)
import {limitBind, limitSource} from "./scripts/directives/limit"
torrentApp.directive("limitBind", limitBind)
torrentApp.directive('limitSource', limitSource)
import { ModalDirective } from "./scripts/directives/modal/modal.directive"
torrentApp.directive('modalNew', ModalDirective.getInstance())
import { AddTorrentModalDirective } from "./scripts/directives/add-torrent-modal/add-torrent-modal.directive";
torrentApp.directive('addTorrentModal', AddTorrentModalDirective.getInstance())
import { TorrentUploadFormDirective } from "./scripts/directives/torrent-upload-form/torrent-upload-form.directive";
torrentApp.directive('torrentUploadForm', TorrentUploadFormDirective.getInstance())

// Components
import {menuWin} from "./scripts/components/menuWin"
torrentApp.factory("menuWin", menuWin)
import {menuMac} from "./scripts/components/menuMac"
torrentApp.factory("menuMac", menuMac)
