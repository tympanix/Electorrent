import { CommonModule } from "@angular/common";
import { Component, HostListener, Inject, NgZone, OnDestroy, OnInit } from "@angular/core";
import { TorrentDetailsFilesTabDirective } from "@renderer/app/directives/torrent-details-files-tab/torrent-details-files-tab.directive";
import { TorrentDetailsInfoTabComponent } from "@renderer/app/directives/torrent-details-info-tab/torrent-details-info-tab.directive";
import { TorrentDetailsPeersTabDirective } from "@renderer/app/directives/torrent-details-peers-tab/torrent-details-peers-tab.directive";
import { TorrentDetailsTrackersTabDirective } from "@renderer/app/directives/torrent-details-trackers-tab/torrent-details-trackers-tab.directive";

export type TorrentDetailsTab = "info" | "files" | "peers" | "trackers";

interface DetailsTorrent {
    id: string;
}

interface TorrentDetailsRootEvents {
    $btclient?: {
        features: {
            torrentPeers?: boolean;
            torrentTrackers?: boolean;
        };
    } | null;
    $on(name: string, callback: (event: unknown, torrent?: DetailsTorrent) => void): () => void;
}

const DEFAULT_PANEL_HEIGHT = 320;
const MIN_PANEL_HEIGHT = 220;

@Component({
    selector: "torrent-details-panel",
    standalone: true,
    imports: [
        CommonModule,
        TorrentDetailsFilesTabDirective,
        TorrentDetailsInfoTabComponent,
        TorrentDetailsPeersTabDirective,
        TorrentDetailsTrackersTabDirective,
    ],
    templateUrl: "./torrent-details-panel.template.html",
})
export class TorrentDetailsPanelDirective implements OnInit, OnDestroy {
    isOpen = false;
    torrent: DetailsTorrent | null = null;
    refresh = 0;
    activeTab: TorrentDetailsTab = "info";
    panelHeight = DEFAULT_PANEL_HEIGHT;

    private resizeStart?: { y: number; height: number };
    private readonly destroyCallbacks: Array<() => void> = [];

    constructor(
        @Inject("$rootScope") private readonly rootEvents: TorrentDetailsRootEvents,
        private readonly zone: NgZone,
    ) {}

    ngOnInit(): void {
        this.destroyCallbacks.push(
            this.rootEvents.$on("torrentDetails:open", (_event, torrent) => {
                this.zone.run(() => this.open(torrent));
            }),
            this.rootEvents.$on("torrentDetails:sync", (_event, torrent) => {
                this.zone.run(() => this.sync(torrent));
            }),
            this.rootEvents.$on("wipe:torrents", () => {
                this.zone.run(() => this.close());
            }),
        );
    }

    ngOnDestroy(): void {
        this.resizeStart = undefined;
        this.destroyCallbacks.splice(0).forEach((destroy) => destroy());
    }

    open(torrent?: DetailsTorrent): void {
        if (!torrent) {
            return;
        }

        this.isOpen = true;
        this.panelHeight = DEFAULT_PANEL_HEIGHT;
        this.activeTab = "info";
        this.torrent = torrent;
        this.refresh += 1;
    }

    close(): void {
        this.resizeStart = undefined;
        this.isOpen = false;
        this.activeTab = "info";
        this.clearSelection();
    }

    showTab(tab: TorrentDetailsTab): void {
        this.activeTab = tab;
    }

    isActiveTab(tab: TorrentDetailsTab): boolean {
        return this.activeTab === tab;
    }

    canShowPeers(): boolean {
        return !!this.rootEvents.$btclient?.features.torrentPeers;
    }

    canShowTrackers(): boolean {
        return !!this.rootEvents.$btclient?.features.torrentTrackers;
    }

    startResizing(event: MouseEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.resizeStart = {
            y: event.clientY,
            height: this.panelHeight,
        };
    }

    @HostListener("document:mousemove", ["$event"])
    resize(event: MouseEvent): void {
        if (!this.resizeStart) {
            return;
        }

        const delta = this.resizeStart.y - event.clientY;
        const maxHeight = Math.max(MIN_PANEL_HEIGHT, (window.innerHeight || this.resizeStart.height) - 140);
        this.panelHeight = Math.max(
            MIN_PANEL_HEIGHT,
            Math.min(maxHeight, this.resizeStart.height + delta),
        );
    }

    @HostListener("document:mouseup")
    stopResizing(): void {
        this.resizeStart = undefined;
    }

    private sync(torrent?: DetailsTorrent): void {
        if (!this.isOpen) {
            return;
        }

        if (!torrent) {
            this.clearSelection();
            return;
        }

        this.torrent = torrent;
        this.refresh += 1;
    }

    private clearSelection(): void {
        this.torrent = null;
        this.refresh += 1;
    }
}
