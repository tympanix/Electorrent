import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Inject, Input, Output } from "@angular/core";
import { matchesLabelFilter, NO_LABEL_FILTER } from "./torrent-label-filter";
import { TorrentSidebarSectionDirective } from "./torrent-sidebar-section.directive";

export interface TorrentSidebarFilters {
    status?: string;
    label?: string;
    tracker?: string;
}

export interface TorrentSidebarSettings {
    ui: {
        sidebarCollapsed?: boolean;
    };
}

export interface TorrentSidebarFeatures {
    labels?: boolean;
    trackerFilter?: boolean;
}

export interface TorrentSidebarTorrent {
    label?: string;
    trackers?: string[];
    isStatusCompleted(): boolean;
    isStatusDownloading(): boolean;
    isStatusPaused(): boolean;
    isStatusQueued(): boolean;
    isStatusSeeding(): boolean;
    isStatusError(): boolean;
    isStatusStopped(): boolean;
}

interface SettingsService {
    saveAllSettings(): Promise<void>;
}

interface NotificationService {
    alert(title: string, message: string): void;
}

@Component({
    selector: "torrent-sidebar",
    standalone: true,
    imports: [CommonModule, TorrentSidebarSectionDirective],
    templateUrl: "./torrent-sidebar.template.html",
})
export class TorrentSidebarDirective {
    @Input() settings: TorrentSidebarSettings = { ui: {} };
    @Input() features: TorrentSidebarFeatures = {};
    @Input() torrents: Record<string, TorrentSidebarTorrent> = {};
    @Input() filters: TorrentSidebarFilters = {};
    @Input() labels: string[] = [];
    @Input() trackers: string[] = [];

    @Output() readonly onStatus = new EventEmitter<string>();
    @Output() readonly onLabel = new EventEmitter<string | undefined>();
    @Output() readonly onTracker = new EventEmitter<string | undefined>();

    readonly noLabelFilter = NO_LABEL_FILTER;

    constructor(
        @Inject("settingsService") private readonly settingsService: SettingsService,
        @Inject("notificationService") private readonly notificationService: NotificationService,
    ) {}

    isCollapsed(): boolean {
        return this.settings.ui.sidebarCollapsed === true;
    }

    async toggleCollapsed(): Promise<void> {
        const previousValue = this.isCollapsed();
        this.settings.ui.sidebarCollapsed = !previousValue;

        try {
            await this.settingsService.saveAllSettings();
        } catch (error) {
            this.settings.ui.sidebarCollapsed = previousValue;
            this.notificationService.alert("Could not save layout", "The sidebar preference could not be saved");
            console.error("Sidebar layout save error", error);
        }
    }

    activeOn(filter: string): boolean {
        return this.filters.status === filter;
    }

    selectStatus(status: string): void {
        this.onStatus.emit(status);
    }

    selectLabel(label?: string): void {
        this.onLabel.emit(label);
    }

    selectTracker(tracker?: string): void {
        this.onTracker.emit(tracker);
    }

    numInStatus(status: string): number {
        return Object.values(this.torrents || {}).filter(this.torrentFilter(status)).length;
    }

    private torrentFilter(status: string): (torrent: TorrentSidebarTorrent) => boolean {
        const filterLabel = this.filters.label;
        const filterTracker = this.filters.tracker;
        const filters: Array<(torrent: TorrentSidebarTorrent) => boolean> = [
            (torrent) => this.statusFilter(torrent, status),
        ];

        if (filterLabel) {
            filters.push((torrent) => matchesLabelFilter(torrent.label, filterLabel));
        }

        if (filterTracker) {
            filters.push((torrent) => this.trackerFilter(torrent, filterTracker));
        }

        return (torrent) => filters.every((filter) => filter(torrent));
    }

    private statusFilter(torrent: TorrentSidebarTorrent, status: string): boolean {
        switch (status) {
            case "all": return true;
            case "finished": return torrent.isStatusCompleted();
            case "downloading": return torrent.isStatusDownloading() || torrent.isStatusPaused();
            case "paused": return torrent.isStatusPaused();
            case "queued": return torrent.isStatusQueued();
            case "seeding": return torrent.isStatusSeeding();
            case "error": return torrent.isStatusError();
            case "stopped": return torrent.isStatusStopped();
            default: return false;
        }
    }

    private trackerFilter(torrent: TorrentSidebarTorrent, filterTracker: string): boolean {
        return !!torrent.trackers?.some((tracker) => tracker.includes(filterTracker));
    }
}

export { TorrentSidebarDirective as TorrentSidebarComponent, TorrentSidebarDirective as TorrentSidebarController };
