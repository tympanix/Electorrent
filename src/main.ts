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
import { ProgressDirective } from "./scripts/directives/progress/progress.directive"
torrentApp.directive("progress", ProgressDirective.getInstance())
import { RightClickDirective } from "./scripts/directives/right-click/right-click.directive"
torrentApp.directive("ngRightClick", RightClickDirective.getInstance())
import { ContextMenuDirective } from "./scripts/directives/context-menu/context-menu.directive"
torrentApp.directive("contextMenu", ContextMenuDirective.getInstance())
import { SemanticDropdownDirective, DropItemDirective } from "./scripts/directives/dropdown/dropdown.directive"
torrentApp.directive("dropdown", SemanticDropdownDirective.getInstance())
torrentApp.directive("dropItem", DropItemDirective.getInstance())
import { ReadyBroadcastDirective } from "./scripts/directives/ready-broadcast/ready-broadcast.directive"
torrentApp.directive("readyBroadcast", ReadyBroadcastDirective.getInstance())
import { AppThemeDirective } from "./scripts/directives/app-theme/app-theme.directive"
torrentApp.directive("appTheme", AppThemeDirective.getInstance())
import { AppShellDirective } from "./scripts/directives/app-shell/app-shell.directive"
torrentApp.directive("appShell", AppShellDirective.getInstance())
import { NotificationsCenterDirective } from "./scripts/directives/notifications-center/notifications-center.directive"
torrentApp.directive("notificationsCenter", NotificationsCenterDirective.getInstance())
import { SettingsPageDirective } from "./scripts/directives/settings-page/settings-page.directive"
torrentApp.directive("settingsPage", SettingsPageDirective.getInstance())
import { SettingsGeneralDirective } from "./scripts/directives/settings-general/settings-general.directive"
torrentApp.directive("settingsGeneral", SettingsGeneralDirective.getInstance())
import { SettingsConnectionDirective } from "./scripts/directives/settings-connection/settings-connection.directive"
torrentApp.directive("settingsConnection", SettingsConnectionDirective.getInstance())
import { SettingsLayoutDirective } from "./scripts/directives/settings-layout/settings-layout.directive"
torrentApp.directive("settingsLayout", SettingsLayoutDirective.getInstance())
import { SettingsServersDirective } from "./scripts/directives/settings-servers/settings-servers.directive"
torrentApp.directive("settingsServers", SettingsServersDirective.getInstance())
import { SettingsAboutDirective } from "./scripts/directives/settings-about/settings-about.directive"
torrentApp.directive("settingsAbout", SettingsAboutDirective.getInstance())
import { WelcomePageDirective } from "./scripts/directives/welcome-page/welcome-page.directive"
torrentApp.directive("welcomePage", WelcomePageDirective.getInstance())
import { ServerSelectionDirective } from "./scripts/directives/server-selection/server-selection.directive"
torrentApp.directive("serverSelection", ServerSelectionDirective.getInstance())
import { TorrentsPageDirective } from "./scripts/directives/torrents-page/torrents-page.directive"
torrentApp.directive("torrentsPage", TorrentsPageDirective.getInstance())
import { ToggleDirective } from "./scripts/directives/checkbox/checkbox.directive"
torrentApp.directive("toggle", ToggleDirective.getInstance())
import { RepeatDoneDirective } from "./scripts/directives/repeat-done/repeat-done.directive"
torrentApp.directive("repeatDone", RepeatDoneDirective.getInstance())
import { LegacyModalDirective } from "./scripts/directives/legacy-modal/legacy-modal.directive"
torrentApp.directive("modal", LegacyModalDirective.getInstance())
import { ActionHeaderDirective } from "./scripts/directives/action-header/action-header.directive"
torrentApp.directive("actionHeader", ActionHeaderDirective.getInstance())
import { LabelsDropdownDirective } from "./scripts/directives/labels-dropdown/labels-dropdown.directive"
torrentApp.directive("labelsDropdown", LabelsDropdownDirective.getInstance())
import { LabelsMenuDirective } from "./scripts/directives/labels-menu/labels-menu.directive"
torrentApp.directive("labelsMenu", LabelsMenuDirective.getInstance())
import { NewLabelModalDirective } from "./scripts/directives/new-label-modal/new-label-modal.directive"
torrentApp.directive("newLabelModal", NewLabelModalDirective.getInstance())
import { DragAndDropDirective } from "./scripts/directives/drag-and-drop/drag-and-drop.directive"
torrentApp.directive("dragAndDrop", DragAndDropDirective.getInstance())
import { SortingDirective, SortDirective } from "./scripts/directives/sorting/sorting.directive"
torrentApp.directive("sorting", SortingDirective.getInstance())
torrentApp.directive("sort", SortDirective.getInstance())
import { DropdownElementDirective, DropdownGroupDirective } from "./scripts/directives/drop/drop.directive"
torrentApp.directive("dropdown", DropdownElementDirective.getInstance())
torrentApp.directive("dropdownGroup", DropdownGroupDirective.getInstance())
import { TorrentBodyDirective, TorrentRowDirective } from "./scripts/directives/torrent-table/torrent-table.directive"
torrentApp.directive("torrentBody", TorrentBodyDirective.getInstance())
torrentApp.directive("torrentRow", TorrentRowDirective.getInstance())
import { SearchDirective } from "./scripts/directives/search/search.directive"
torrentApp.directive("search", SearchDirective.getInstance())
import { TimeDirective } from "./scripts/directives/time/time.directive"
torrentApp.directive("time", TimeDirective.getInstance())
import { LimitBindDirective, LimitSourceDirective } from "./scripts/directives/limit/limit.directive"
torrentApp.directive("limitBind", LimitBindDirective.getInstance())
torrentApp.directive("limitSource", LimitSourceDirective.getInstance())
import { ModalDirective } from "./scripts/directives/modal/modal.directive"
torrentApp.directive('modalNew', ModalDirective.getInstance())
import { RenameServerModalDirective } from "./scripts/directives/rename-server-modal/rename-server-modal.directive"
torrentApp.directive("renameServerModal", RenameServerModalDirective.getInstance())
import { UpdateModalDirective } from "./scripts/directives/update-modal/update-modal.directive"
torrentApp.directive("updateModal", UpdateModalDirective.getInstance())
import { CertificateModalDirective } from "./scripts/directives/certificate-modal/certificate-modal.directive"
torrentApp.directive("certificateModal", CertificateModalDirective.getInstance())
import { AddTorrentModalDirective } from "./scripts/directives/add-torrent-modal/add-torrent-modal.directive";
torrentApp.directive('addTorrentModal', AddTorrentModalDirective.getInstance())
import { TorrentUploadFormDirective } from "./scripts/directives/torrent-upload-form/torrent-upload-form.directive";
torrentApp.directive('torrentUploadForm', TorrentUploadFormDirective.getInstance())
import { TorrentFilesTreeDirective } from "./scripts/directives/torrent-files-tree/torrent-files-tree.directive";
torrentApp.directive('torrentFilesTree', TorrentFilesTreeDirective.getInstance())
import { indeterminateValueDirective } from "./scripts/directives/torrent-files-tree/indeterminate-value.directive";
torrentApp.directive('indeterminateValue', indeterminateValueDirective)
import { TorrentFilesModalDirective } from "./scripts/directives/torrent-files-modal/torrent-files-modal.directive";
torrentApp.directive('torrentFilesModal', TorrentFilesModalDirective.getInstance())

// Components
import {menuWin} from "./scripts/components/menuWin"
torrentApp.factory("menuWin", menuWin)
import {menuMac} from "./scripts/components/menuMac"
torrentApp.factory("menuMac", menuMac)
