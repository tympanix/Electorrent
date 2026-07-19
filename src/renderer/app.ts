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
    DelugeClient,
    MockBittorrentClient
} from "@renderer/app/bittorrent"
import { CLIENT_METADATA, type ClientId } from "@shared/client-metadata"
import { torrentApp } from "@renderer/app/app.module"
import "@renderer/app/directives"

// Configure the application
torrentApp.config(['$animateProvider', function($animateProvider) {
        $animateProvider.classNameFilter(/\banimated\b|\btransition\b/);
    }
]);

interface ClientRegistration {
    name: string
    service: unknown
    icon: string
}

const clientFactories = {
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

    btclients[clientId] = {
        name: CLIENT_METADATA[clientId].name,
        service: clientFactories[clientId](),
        icon: CLIENT_METADATA[clientId].icon,
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
