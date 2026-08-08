import { CommonModule } from "@angular/common";
import {
    Component,
    DoCheck,
    Inject,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    Optional,
} from "@angular/core";
import {
    SortHeaderDirective,
    SortingDirective,
} from "@renderer/app/directives/sorting/sorting.directive";
import type { SortChange } from "@renderer/app/directives/sorting/sorting.controller";
import type { BittorrentTorrentDetailsTracker } from "@shared/ipc-contract";
import moment from "moment";

interface TrackerTorrent {
    id: string;
}

interface TrackerClient {
    id?: string;
    getTorrentDetailsTrackers(torrent: TrackerTorrent): Promise<{
        items?: BittorrentTorrentDetailsTracker[];
    } | null | undefined>;
}

interface TrackersRootState {
    $btclient?: TrackerClient | null;
    $server?: { id?: string } | null;
}

interface TrackersSettingsService {
    getAllSettings(): { ui: { resizeMode?: string } };
}

interface TorrentDetailsTrackerColumn {
    id: keyof BittorrentTorrentDetailsTracker;
    label: string;
    sortType: "alphabetical" | "numeric";
}

@Component({
    selector: "torrent-details-trackers-tab",
    standalone: true,
    imports: [CommonModule, SortingDirective, SortHeaderDirective],
    templateUrl: "./torrent-details-trackers-tab.template.html",
})
export class TorrentDetailsTrackersTabComponent implements DoCheck, OnChanges, OnDestroy, OnInit {
    @Input() torrent?: TrackerTorrent;
    @Input() refresh = 0;
    @Input() client?: TrackerClient;

    readonly columns: TorrentDetailsTrackerColumn[] = [
        { id: "url", label: "URL", sortType: "alphabetical" },
        { id: "status", label: "Status", sortType: "alphabetical" },
        { id: "tier", label: "Tier", sortType: "numeric" },
        { id: "peers", label: "Peers", sortType: "numeric" },
        { id: "seeds", label: "Seeds", sortType: "numeric" },
        { id: "leeches", label: "Leeches", sortType: "numeric" },
        { id: "downloaded", label: "Downloaded", sortType: "numeric" },
        { id: "lastAnnounce", label: "Last announce", sortType: "numeric" },
        { id: "nextAnnounce", label: "Next announce", sortType: "numeric" },
        { id: "message", label: "Message", sortType: "alphabetical" },
    ];
    trackers: BittorrentTorrentDetailsTracker[] = [];
    sortedTrackers: BittorrentTorrentDetailsTracker[] = [];
    resizeMode = "OverflowResizer";
    resizeProfile = "torrent-details-trackers.default";
    loading = false;
    loaded = false;
    error: string | null = null;

    private sortKey: keyof BittorrentTorrentDetailsTracker = "url";
    private sortDescending = false;
    private requestId = 0;
    private torrentId?: string;
    private configuredServerId?: string;
    private configuredResizeMode?: string;

    constructor(
        @Optional() @Inject("$rootScope") private readonly rootState: TrackersRootState | null,
        @Inject("settingsService") private readonly settingsService: TrackersSettingsService,
    ) {}

    ngOnInit(): void {
        this.configureResize();
    }

    ngOnChanges(): void {
        void this.load();
    }

    ngDoCheck(): void {
        const serverId = this.rootState?.$server?.id
            || this.rootState?.$btclient?.id
            || this.client?.id
            || "default";
        const resizeMode = this.settingsService.getAllSettings().ui.resizeMode || "OverflowResizer";
        if (serverId !== this.configuredServerId || resizeMode !== this.configuredResizeMode) {
            this.configureResize(serverId, resizeMode);
        }
    }

    ngOnDestroy(): void {
        this.requestId += 1;
    }

    changeSorting({
        sortKey,
        descending,
    }: SortChange): void {
        const column = this.columns.find(({ id }) => id === sortKey);
        if (!column) return;

        this.sortKey = column.id;
        this.sortDescending = descending;
        this.sortTrackers();
    }

    formatEpoch(value: number | string | null | undefined): string {
        const epoch = Number(value);
        return epoch ? moment(epoch * 1000).format("MMMM Do YYYY, HH:mm") : "";
    }

    trackColumn(_index: number, column: TorrentDetailsTrackerColumn): string {
        return column.id;
    }

    trackTracker(index: number): number {
        return index;
    }

    private async load(): Promise<void> {
        const torrent = this.torrent;
        if (!torrent) return;

        if (this.torrentId !== torrent.id) {
            this.torrentId = torrent.id;
            this.trackers = [];
            this.sortedTrackers = [];
            this.loaded = false;
        }

        const requestId = ++this.requestId;
        this.loading = true;
        this.error = null;

        try {
            const client = this.client || this.rootState?.$btclient;
            if (!client) {
                throw new Error("No torrent client is connected");
            }
            const data = await client.getTorrentDetailsTrackers(torrent);
            if (!this.isCurrentRequest(requestId, torrent)) return;

            this.trackers = data?.items || [];
            this.sortTrackers();
            this.loaded = true;
        } catch (error) {
            if (this.isCurrentRequest(requestId, torrent) && !this.loaded) {
                const message = error && typeof error === "object" && "message" in error
                    ? String(error.message)
                    : "";
                this.error = message || "Failed to load torrent trackers";
            }
        } finally {
            if (this.isCurrentRequest(requestId, torrent)) {
                this.loading = false;
            }
        }
    }

    private isCurrentRequest(requestId: number, torrent: TrackerTorrent): boolean {
        return requestId === this.requestId && this.torrent === torrent;
    }

    private configureResize(serverId?: string, resizeMode?: string): void {
        const resolvedServerId = serverId
            || this.rootState?.$server?.id
            || this.rootState?.$btclient?.id
            || this.client?.id
            || "default";
        const resolvedResizeMode = resizeMode
            || this.settingsService.getAllSettings().ui.resizeMode
            || "OverflowResizer";
        this.configuredServerId = resolvedServerId;
        this.configuredResizeMode = resolvedResizeMode;
        this.resizeMode = resolvedResizeMode;
        this.resizeProfile = `torrent-details-trackers.${resolvedServerId}`;
    }

    private sortTrackers(): void {
        const column = this.columns.find(({ id }) => id === this.sortKey) || this.columns[0];
        this.sortedTrackers = [...this.trackers].sort((left, right) => {
            const leftValue = left[column.id];
            const rightValue = right[column.id];
            const compared = column.sortType === "numeric"
                ? Number(leftValue ?? 0) - Number(rightValue ?? 0)
                : String(leftValue ?? "").localeCompare(
                    String(rightValue ?? ""),
                    undefined,
                    { sensitivity: "base" },
                );
            return this.sortDescending ? -compared : compared;
        });
    }
}

// Transitional alias for imports that still use the old directive name.
export { TorrentDetailsTrackersTabComponent as TorrentDetailsTrackersTabDirective };
