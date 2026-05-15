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
} from "./app/bittorrent"
import { CLIENT_METADATA } from "../shared/client-metadata"

var torrentApp = angular.module("torrentApp", ["ngResource", "ngAnimate", "rzTable", "infinite-scroll", "hc.marked", "ui.sortable"]);

// Configure the application
torrentApp.config(['$animateProvider', function($animateProvider) {
        $animateProvider.classNameFilter(/\banimated\b|\btransition\b/);
    }
]);

// Register torrent clients
torrentApp.constant('$btclients', {
    'utorrent': {
        name: CLIENT_METADATA.utorrent.name,
        service: new UtorrentClient(),
        icon: CLIENT_METADATA.utorrent.icon
    },
     'qbittorrent': {
        name: CLIENT_METADATA.qbittorrent.name,
        service: new QBittorrentClient(),
        icon: CLIENT_METADATA.qbittorrent.icon
    },
    'transmission': {
        name: CLIENT_METADATA.transmission.name,
        service: new TransmissionClient(),
        icon: CLIENT_METADATA.transmission.icon
    },
    'rtorrent': {
        name: CLIENT_METADATA.rtorrent.name,
        service: new RtorrentClient(),
        icon: CLIENT_METADATA.rtorrent.icon
    },
    'synology': {
        name: CLIENT_METADATA.synology.name,
        service: new SynologyClient(),
        icon: CLIENT_METADATA.synology.icon
    },
    'deluge': {
        name: CLIENT_METADATA.deluge.name,
        service: new DelugeClient(),
        icon: CLIENT_METADATA.deluge.icon,
    }
});

// Configure the client
torrentApp.run(["configService", function(config){
    config.initSettings()
        .catch(() => {
            window.electorrent.app.reportCorruptSettings()
        })
}]);

// Services
import { httpFormService } from "./app/services/httpFormService"
torrentApp.factory("httpFormService", httpFormService)
import { bittorrentService } from "./app/services/bittorrent"
torrentApp.service("$bittorrent", bittorrentService)
import { configService } from "./app/services/settings"
torrentApp.service("configService", configService)
import { notificationService } from "./app/services/notification"
torrentApp.service("notificationService", notificationService)
import { serverService} from "./app/services/server"
torrentApp.factory("Server", serverService)

// Filters
import { DateFilter } from "./app/filters/date.filter"
torrentApp.filter("date", DateFilter.getInstance())
import { EtaFilter } from "./app/filters/eta.filter"
torrentApp.filter("eta", EtaFilter.getInstance())
import { ReleaseDateFilter } from "./app/filters/release-date.filter"
torrentApp.filter("releaseDate", ReleaseDateFilter.getInstance())
import { EpochFilter } from "./app/filters/epoch.filter"
torrentApp.filter("epoch", EpochFilter.getInstance())
import { BytesFilter } from "./app/filters/bytes.filter"
torrentApp.filter("bytes", BytesFilter.getInstance())
import { SpeedFilter } from "./app/filters/speed.filter"
torrentApp.filter("speed", SpeedFilter.getInstance())
import { TorrentQueueFilter } from "./app/filters/torrent-queue.filter"
torrentApp.filter("torrentQueue", TorrentQueueFilter.getInstance())
import { TorrentRatioFilter } from "./app/filters/torrent-ratio.filter"
torrentApp.filter("torrentRatio", TorrentRatioFilter.getInstance())
import { TorrentTrackerFilter } from "./app/filters/torrent-tracker.filter"
torrentApp.filter("torrentTracker", TorrentTrackerFilter.getInstance())

// Directives
import { ProgressDirective } from "./app/directives/progress/progress.directive"
torrentApp.directive("progress", ProgressDirective.getInstance())
import { RightClickDirective } from "./app/directives/right-click/right-click.directive"
torrentApp.directive("ngRightClick", RightClickDirective.getInstance())
import { ContextMenuDirective } from "./app/directives/context-menu/context-menu.directive"
torrentApp.directive("contextMenu", ContextMenuDirective.getInstance())
import { SemanticDropdownDirective, DropItemDirective } from "./app/directives/dropdown/dropdown.directive"
torrentApp.directive("dropdown", SemanticDropdownDirective.getInstance())
torrentApp.directive("dropItem", DropItemDirective.getInstance())
import { ReadyBroadcastDirective } from "./app/directives/ready-broadcast/ready-broadcast.directive"
torrentApp.directive("readyBroadcast", ReadyBroadcastDirective.getInstance())
import { AppThemeDirective } from "./app/directives/app-theme/app-theme.directive"
torrentApp.directive("appTheme", AppThemeDirective.getInstance())
import { AppShellDirective } from "./app/directives/app-shell/app-shell.directive"
torrentApp.directive("appShell", AppShellDirective.getInstance())
import { NotificationsCenterDirective } from "./app/directives/notifications-center/notifications-center.directive"
torrentApp.directive("notificationsCenter", NotificationsCenterDirective.getInstance())
import { SettingsPageDirective } from "./app/directives/settings-page/settings-page.directive"
torrentApp.directive("settingsPage", SettingsPageDirective.getInstance())
import { SettingsGeneralDirective } from "./app/directives/settings-general/settings-general.directive"
torrentApp.directive("settingsGeneral", SettingsGeneralDirective.getInstance())
import { SettingsConnectionDirective } from "./app/directives/settings-connection/settings-connection.directive"
torrentApp.directive("settingsConnection", SettingsConnectionDirective.getInstance())
import { SettingsLayoutDirective } from "./app/directives/settings-layout/settings-layout.directive"
torrentApp.directive("settingsLayout", SettingsLayoutDirective.getInstance())
import { SettingsServersDirective } from "./app/directives/settings-servers/settings-servers.directive"
torrentApp.directive("settingsServers", SettingsServersDirective.getInstance())
import { SettingsAboutDirective } from "./app/directives/settings-about/settings-about.directive"
torrentApp.directive("settingsAbout", SettingsAboutDirective.getInstance())
import { WelcomePageDirective } from "./app/directives/welcome-page/welcome-page.directive"
torrentApp.directive("welcomePage", WelcomePageDirective.getInstance())
import { ServerSelectionDirective } from "./app/directives/server-selection/server-selection.directive"
torrentApp.directive("serverSelection", ServerSelectionDirective.getInstance())
import { TorrentsPageDirective } from "./app/directives/torrents-page/torrents-page.directive"
torrentApp.directive("torrentsPage", TorrentsPageDirective.getInstance())
import { ToggleDirective } from "./app/directives/checkbox/checkbox.directive"
torrentApp.directive("toggle", ToggleDirective.getInstance())
import { RepeatDoneDirective } from "./app/directives/repeat-done/repeat-done.directive"
torrentApp.directive("repeatDone", RepeatDoneDirective.getInstance())
import { ModalDirective } from "./app/directives/modal/modal.directive"
torrentApp.directive("modal", ModalDirective.getInstance())
import { ActionHeaderDirective } from "./app/directives/action-header/action-header.directive"
torrentApp.directive("actionHeader", ActionHeaderDirective.getInstance())
import { LabelsDropdownDirective } from "./app/directives/labels-dropdown/labels-dropdown.directive"
torrentApp.directive("labelsDropdown", LabelsDropdownDirective.getInstance())
import { LabelsMenuDirective } from "./app/directives/labels-menu/labels-menu.directive"
torrentApp.directive("labelsMenu", LabelsMenuDirective.getInstance())
import { NewLabelModalDirective } from "./app/directives/new-label-modal/new-label-modal.directive"
torrentApp.directive("newLabelModal", NewLabelModalDirective.getInstance())
import { DragAndDropDirective } from "./app/directives/drag-and-drop/drag-and-drop.directive"
torrentApp.directive("dragAndDrop", DragAndDropDirective.getInstance())
import { SortingDirective, SortDirective } from "./app/directives/sorting/sorting.directive"
torrentApp.directive("sorting", SortingDirective.getInstance())
torrentApp.directive("sort", SortDirective.getInstance())
import { DropdownElementDirective, DropdownGroupDirective } from "./app/directives/drop/drop.directive"
torrentApp.directive("dropdown", DropdownElementDirective.getInstance())
torrentApp.directive("dropdownGroup", DropdownGroupDirective.getInstance())
import { TorrentBodyDirective, TorrentRowDirective } from "./app/directives/torrent-table/torrent-table.directive"
torrentApp.directive("torrentBody", TorrentBodyDirective.getInstance())
torrentApp.directive("torrentRow", TorrentRowDirective.getInstance())
import { SearchDirective } from "./app/directives/search/search.directive"
torrentApp.directive("search", SearchDirective.getInstance())
import { TimeDirective } from "./app/directives/time/time.directive"
torrentApp.directive("time", TimeDirective.getInstance())
import { LimitBindDirective, LimitSourceDirective } from "./app/directives/limit/limit.directive"
torrentApp.directive("limitBind", LimitBindDirective.getInstance())
torrentApp.directive("limitSource", LimitSourceDirective.getInstance())
import { RenameServerModalDirective } from "./app/directives/rename-server-modal/rename-server-modal.directive"
torrentApp.directive("renameServerModal", RenameServerModalDirective.getInstance())
import { UpdateModalDirective } from "./app/directives/update-modal/update-modal.directive"
torrentApp.directive("updateModal", UpdateModalDirective.getInstance())
import { CertificateModalDirective } from "./app/directives/certificate-modal/certificate-modal.directive"
torrentApp.directive("certificateModal", CertificateModalDirective.getInstance())
import { AddTorrentModalDirective } from "./app/directives/add-torrent-modal/add-torrent-modal.directive";
torrentApp.directive('addTorrentModal', AddTorrentModalDirective.getInstance())
import { TorrentUploadFormDirective } from "./app/directives/torrent-upload-form/torrent-upload-form.directive";
torrentApp.directive('torrentUploadForm', TorrentUploadFormDirective.getInstance())
import { TorrentFilesTreeDirective } from "./app/directives/torrent-files-tree/torrent-files-tree.directive";
torrentApp.directive('torrentFilesTree', TorrentFilesTreeDirective.getInstance())
import { indeterminateValueDirective } from "./app/directives/torrent-files-tree/indeterminate-value.directive";
torrentApp.directive('indeterminateValue', indeterminateValueDirective)
import { TorrentFilesModalDirective } from "./app/directives/torrent-files-modal/torrent-files-modal.directive";
torrentApp.directive('torrentFilesModal', TorrentFilesModalDirective.getInstance())
