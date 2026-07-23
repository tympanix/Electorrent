// declare global {
//     const angular: ng.IAngularStatic;
// }

// Import all client implementations
import {
    Aria2Client,
    UtorrentClient,
    QBittorrentClient,
    TransmissionClient,
    RtorrentClient,
    SynologyClient,
    DelugeClient,
    MockBittorrentClient
} from "@renderer/app/bittorrent"
import { CLIENT_METADATA, type ClientId, type ClientMetadata } from "@shared/client-metadata"

const torrentApp = angular.module("torrentApp", ["ngResource", "ngAnimate", "rzTable", "infinite-scroll", "hc.marked", "ui.sortable"]);

// Configure the application
torrentApp.config(['$animateProvider', function($animateProvider) {
        $animateProvider.classNameFilter(/\banimated\b|\btransition\b/);
    }
]);

interface ClientRegistration {
    name: string
    service: unknown
    icon: string
    defaultPort?: number
}

const clientFactories = {
    aria2: () => new Aria2Client(),
    utorrent: () => new UtorrentClient(),
    qbittorrent: () => new QBittorrentClient(),
    transmission: () => new TransmissionClient(),
    rtorrent: () => new RtorrentClient(),
    synology: () => new SynologyClient(),
    deluge: () => new DelugeClient(),
    mock: () => new MockBittorrentClient(),
} satisfies Record<ClientId, () => unknown>

const btclients: Record<string, ClientRegistration> = {}

for (const clientId of Object.keys(clientFactories) as ClientId[]) {
    if (clientId === "mock" && !window.electorrent.app.isTestEnvironment) {
        continue
    }

    const metadata: ClientMetadata = CLIENT_METADATA[clientId]
    btclients[clientId] = {
        name: metadata.name,
        service: clientFactories[clientId](),
        icon: metadata.icon,
        defaultPort: metadata.defaultPort,
    }
}

// Register torrent clients
torrentApp.constant('$btclients', btclients);

// Configure the client
torrentApp.run(["settingsService", function(settingsService){
    settingsService.initSettings()
        .catch(() => {
            window.electorrent.app.reportCorruptSettings()
        })
}]);

// Services
import { httpFormService } from "@renderer/app/services/httpFormService"
torrentApp.factory("httpFormService", httpFormService)
import { bittorrentService } from "@renderer/app/services/bittorrent"
torrentApp.service("$bittorrent", bittorrentService)
import { settingsService } from "@renderer/app/services/settings"
torrentApp.service("settingsService", settingsService)
import { notificationService } from "@renderer/app/services/notification"
torrentApp.service("notificationService", notificationService)
import { CertificateResponseService } from "@renderer/app/services/certificate-response"
torrentApp.service("certificateResponseService", CertificateResponseService)
import { labelColorService } from "@renderer/app/services/label-colors"
torrentApp.service("labelColorService", labelColorService)
import { serverService} from "@renderer/app/services/server"
torrentApp.factory("Server", serverService)

// Filters
import { DateFilter } from "@renderer/app/filters/date.filter"
torrentApp.filter("date", DateFilter.getInstance())
import { EtaFilter } from "@renderer/app/filters/eta.filter"
torrentApp.filter("eta", EtaFilter.getInstance())
import { ReleaseDateFilter } from "@renderer/app/filters/release-date.filter"
torrentApp.filter("releaseDate", ReleaseDateFilter.getInstance())
import { EpochFilter } from "@renderer/app/filters/epoch.filter"
torrentApp.filter("epoch", EpochFilter.getInstance())
import { BytesFilter } from "@renderer/app/filters/bytes.filter"
torrentApp.filter("bytes", BytesFilter.getInstance())
import { SpeedFilter } from "@renderer/app/filters/speed.filter"
torrentApp.filter("speed", SpeedFilter.getInstance())
import { SpeedLimitFilter } from "@renderer/app/filters/speed-limit.filter"
torrentApp.filter("speedLimit", SpeedLimitFilter.getInstance())
import { TorrentQueueFilter } from "@renderer/app/filters/torrent-queue.filter"
torrentApp.filter("torrentQueue", TorrentQueueFilter.getInstance())
import { TorrentRatioFilter } from "@renderer/app/filters/torrent-ratio.filter"
torrentApp.filter("torrentRatio", TorrentRatioFilter.getInstance())
import { TorrentTrackerFilter } from "@renderer/app/filters/torrent-tracker.filter"
torrentApp.filter("torrentTracker", TorrentTrackerFilter.getInstance())

// Directives
import { ProgressDirective } from "@renderer/app/directives/progress/progress.directive"
torrentApp.directive("progress", ProgressDirective.getInstance())
import { RightClickDirective } from "@renderer/app/directives/right-click/right-click.directive"
torrentApp.directive("ngRightClick", RightClickDirective.getInstance())
import { ContextMenuDirective } from "@renderer/app/directives/context-menu/context-menu.directive"
torrentApp.directive("contextMenu", ContextMenuDirective.getInstance())
import { SemanticDropdownDirective, DropItemDirective } from "@renderer/app/directives/dropdown/dropdown.directive"
torrentApp.directive("dropdown", SemanticDropdownDirective.getInstance())
torrentApp.directive("dropItem", DropItemDirective.getInstance())
import { ReadyBroadcastDirective } from "@renderer/app/directives/ready-broadcast/ready-broadcast.directive"
torrentApp.directive("readyBroadcast", ReadyBroadcastDirective.getInstance())
import { AppThemeDirective } from "@renderer/app/directives/app-theme/app-theme.directive"
torrentApp.directive("appTheme", AppThemeDirective.getInstance())
import { AppShellDirective } from "@renderer/app/directives/app-shell/app-shell.directive"
torrentApp.directive("appShell", AppShellDirective.getInstance())
import { TitleBarMenuDirective } from "@renderer/app/directives/title-bar-menu/title-bar-menu.directive"
torrentApp.directive("titleBarMenu", TitleBarMenuDirective.getInstance())
import { NotificationsCenterDirective } from "@renderer/app/directives/notifications-center/notifications-center.directive"
torrentApp.directive("notificationsCenter", NotificationsCenterDirective.getInstance())
import { SettingsPageDirective } from "@renderer/app/directives/settings-page/settings-page.directive"
torrentApp.directive("settingsPage", SettingsPageDirective.getInstance())
import { SettingsGeneralDirective } from "@renderer/app/directives/settings-general/settings-general.directive"
torrentApp.directive("settingsGeneral", SettingsGeneralDirective.getInstance())
import { SettingsConnectionDirective } from "@renderer/app/directives/settings-connection/settings-connection.directive"
torrentApp.directive("settingsConnection", SettingsConnectionDirective.getInstance())
import { ConnectionFormDirective } from "@renderer/app/directives/connection-form/connection-form.directive"
torrentApp.directive("connectionForm", ConnectionFormDirective.getInstance())
import { SettingsLayoutDirective } from "@renderer/app/directives/settings-layout/settings-layout.directive"
torrentApp.directive("settingsLayout", SettingsLayoutDirective.getInstance())
import { SettingsServersDirective } from "@renderer/app/directives/settings-servers/settings-servers.directive"
torrentApp.directive("settingsServers", SettingsServersDirective.getInstance())
import { SettingsAboutDirective } from "@renderer/app/directives/settings-about/settings-about.directive"
torrentApp.directive("settingsAbout", SettingsAboutDirective.getInstance())
import { SettingsAdvancedDirective } from "@renderer/app/directives/settings-advanced/settings-advanced.directive"
torrentApp.directive("settingsAdvanced", SettingsAdvancedDirective.getInstance())
import { WelcomePageDirective } from "@renderer/app/directives/welcome-page/welcome-page.directive"
torrentApp.directive("welcomePage", WelcomePageDirective.getInstance())
import { ServerSelectionDirective } from "@renderer/app/directives/server-selection/server-selection.directive"
torrentApp.directive("serverSelection", ServerSelectionDirective.getInstance())
import { TorrentsPageDirective } from "@renderer/app/directives/torrents-page/torrents-page.directive"
torrentApp.directive("torrentsPage", TorrentsPageDirective.getInstance())
import { TorrentSidebarDirective } from "@renderer/app/directives/torrent-sidebar/torrent-sidebar.directive"
torrentApp.directive("torrentSidebar", TorrentSidebarDirective.getInstance())
import { TorrentSidebarSectionDirective } from "@renderer/app/directives/torrent-sidebar/torrent-sidebar-section.directive"
torrentApp.directive("torrentSidebarSection", TorrentSidebarSectionDirective.getInstance())
import { ToggleDirective } from "@renderer/app/directives/checkbox/checkbox.directive"
torrentApp.directive("toggle", ToggleDirective.getInstance())
import { RepeatDoneDirective } from "@renderer/app/directives/repeat-done/repeat-done.directive"
torrentApp.directive("repeatDone", RepeatDoneDirective.getInstance())
import { ModalDirective } from "@renderer/app/directives/modal/modal.directive"
torrentApp.directive("modal", ModalDirective.getInstance())
import { ActionHeaderDirective } from "@renderer/app/directives/action-header/action-header.directive"
torrentApp.directive("actionHeader", ActionHeaderDirective.getInstance())
import { LabelsDropdownDirective } from "@renderer/app/directives/labels-dropdown/labels-dropdown.directive"
torrentApp.directive("labelsDropdown", LabelsDropdownDirective.getInstance())
import { LabelsMenuDirective } from "@renderer/app/directives/labels-menu/labels-menu.directive"
torrentApp.directive("labelsMenu", LabelsMenuDirective.getInstance())
import { LabelChipDirective } from "@renderer/app/directives/label-chip/label-chip.directive"
torrentApp.directive("labelChip", LabelChipDirective.getInstance())
import { NewLabelModalDirective } from "@renderer/app/directives/new-label-modal/new-label-modal.directive"
torrentApp.directive("newLabelModal", NewLabelModalDirective.getInstance())
import { DragAndDropDirective } from "@renderer/app/directives/drag-and-drop/drag-and-drop.directive"
torrentApp.directive("dragAndDrop", DragAndDropDirective.getInstance())
import { SortingDirective, SortDirective } from "@renderer/app/directives/sorting/sorting.directive"
torrentApp.directive("sorting", SortingDirective.getInstance())
torrentApp.directive("sort", SortDirective.getInstance())
import { DropdownElementDirective, DropdownGroupDirective } from "@renderer/app/directives/drop/drop.directive"
torrentApp.directive("dropdown", DropdownElementDirective.getInstance())
torrentApp.directive("dropdownGroup", DropdownGroupDirective.getInstance())
import { TorrentBodyDirective, TorrentRowDirective } from "@renderer/app/directives/torrent-table/torrent-table.directive"
torrentApp.directive("torrentBody", TorrentBodyDirective.getInstance())
torrentApp.directive("torrentRow", TorrentRowDirective.getInstance())
import { SearchDirective } from "@renderer/app/directives/search/search.directive"
torrentApp.directive("search", SearchDirective.getInstance())
import { TimeDirective } from "@renderer/app/directives/time/time.directive"
torrentApp.directive("time", TimeDirective.getInstance())
import { LimitBindDirective, LimitSourceDirective } from "@renderer/app/directives/limit/limit.directive"
torrentApp.directive("limitBind", LimitBindDirective.getInstance())
torrentApp.directive("limitSource", LimitSourceDirective.getInstance())
import { RenameServerModalDirective } from "@renderer/app/directives/rename-server-modal/rename-server-modal.directive"
torrentApp.directive("renameServerModal", RenameServerModalDirective.getInstance())
import { UpdateModalDirective } from "@renderer/app/directives/update-modal/update-modal.directive"
torrentApp.directive("updateModal", UpdateModalDirective.getInstance())
import { CertificateModalDirective } from "@renderer/app/directives/certificate-modal/certificate-modal.directive"
torrentApp.directive("certificateModal", CertificateModalDirective.getInstance())
import { InsecureTlsModalDirective } from "@renderer/app/directives/insecure-tls-modal/insecure-tls-modal.directive"
torrentApp.directive("insecureTlsModal", InsecureTlsModalDirective.getInstance())
import { AddTorrentModalDirective } from "@renderer/app/directives/add-torrent-modal/add-torrent-modal.directive";
torrentApp.directive('addTorrentModal', AddTorrentModalDirective.getInstance())
import { TorrentUploadFormDirective } from "@renderer/app/directives/torrent-upload-form/torrent-upload-form.directive";
torrentApp.directive('torrentUploadForm', TorrentUploadFormDirective.getInstance())
import { TorrentUploadFileSelectionDirective } from "@renderer/app/directives/torrent-upload-file-selection/torrent-upload-file-selection.directive";
torrentApp.directive('torrentUploadFileSelection', TorrentUploadFileSelectionDirective.getInstance())
import { TorrentFilesTreeDirective } from "@renderer/app/directives/torrent-files-tree/torrent-files-tree.directive";
torrentApp.directive('torrentFilesTree', TorrentFilesTreeDirective.getInstance())
import { indeterminateValueDirective } from "@renderer/app/directives/torrent-files-tree/indeterminate-value.directive";
torrentApp.directive('indeterminateValue', indeterminateValueDirective)
import { TorrentFilesModalDirective } from "@renderer/app/directives/torrent-files-modal/torrent-files-modal.directive";
torrentApp.directive('torrentFilesModal', TorrentFilesModalDirective.getInstance())
import { TorrentDetailsPanelDirective } from "@renderer/app/directives/torrent-details-panel/torrent-details-panel.directive";
torrentApp.directive('torrentDetailsPanel', TorrentDetailsPanelDirective.getInstance())
import { TorrentDetailsInfoTabDirective } from "@renderer/app/directives/torrent-details-info-tab/torrent-details-info-tab.directive";
torrentApp.directive('torrentDetailsInfoTab', TorrentDetailsInfoTabDirective.getInstance())
import { TorrentDetailsFilesTabDirective } from "@renderer/app/directives/torrent-details-files-tab/torrent-details-files-tab.directive";
torrentApp.directive('torrentDetailsFilesTab', TorrentDetailsFilesTabDirective.getInstance())
import { TorrentDetailsPeersTabDirective } from "@renderer/app/directives/torrent-details-peers-tab/torrent-details-peers-tab.directive";
torrentApp.directive('torrentDetailsPeersTab', TorrentDetailsPeersTabDirective.getInstance())
import { TorrentDetailsTrackersTabDirective } from "@renderer/app/directives/torrent-details-trackers-tab/torrent-details-trackers-tab.directive";
torrentApp.directive('torrentDetailsTrackersTab', TorrentDetailsTrackersTabDirective.getInstance())
import { SetLocationModalDirective } from "@renderer/app/directives/set-location-modal/set-location-modal.directive";
torrentApp.directive('setLocationModal', SetLocationModalDirective.getInstance())
import { TorrentSpeedModalDirective } from "@renderer/app/directives/torrent-speed-modal/torrent-speed-modal.directive";
torrentApp.directive('torrentSpeedModal', TorrentSpeedModalDirective.getInstance())
import { TorrentSetRatioModalDirective } from "@renderer/app/directives/torrent-set-ratio-modal/torrent-set-ratio-modal.directive";
torrentApp.directive('torrentSetRatioModal', TorrentSetRatioModalDirective.getInstance())
import { SavedLocationModalDirective } from "@renderer/app/directives/saved-location-modal/saved-location-modal.directive";
torrentApp.directive('savedLocationModal', SavedLocationModalDirective.getInstance())
import { LabelColorModalDirective } from "@renderer/app/directives/label-color-modal/label-color-modal.directive";
torrentApp.directive('labelColorModal', LabelColorModalDirective.getInstance())
