import { IDirective, IDirectiveFactory } from "angular";
import { torrentApp } from "@renderer/app/app.module"
import { matchesLabelFilter, NO_LABEL_FILTER } from "./torrent-label-filter";
import html from "./torrent-sidebar.template.html";

interface TorrentSidebarFilters {
    status?: string;
    label?: string;
    tracker?: string;
}

interface TorrentSidebarSettings {
    ui: {
        sidebarCollapsed?: boolean;
    };
}

interface TorrentSidebarFeatures {
    labels?: boolean;
    trackerFilter?: boolean;
}

interface TorrentLike {
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

export class TorrentSidebarController {
    settings!: TorrentSidebarSettings;
    features: TorrentSidebarFeatures = {};
    torrents: Record<string, TorrentLike> = {};
    filters: TorrentSidebarFilters = {};
    labels: string[] = [];
    trackers: string[] = [];
    noLabelFilter = NO_LABEL_FILTER;
    onStatus?: (locals: { status: string }) => void;
    onLabel?: (locals: { label?: string }) => void;
    onTracker?: (locals: { tracker?: string }) => void;

    static $inject = ["settingsService", "notificationService"];

    constructor(
        private settingsService: { saveAllSettings(): Promise<void> },
        private $notify: { alert(title: string, message: string): void },
    ) {}

    isCollapsed() {
        return this.settings?.ui.sidebarCollapsed === true;
    }

    toggleCollapsed() {
        const previousValue = this.isCollapsed();
        this.settings.ui.sidebarCollapsed = !previousValue;

        return this.settingsService.saveAllSettings().catch((err: unknown) => {
            this.settings.ui.sidebarCollapsed = previousValue;
            this.$notify.alert("Could not save layout", "The sidebar preference could not be saved");
            console.error("Sidebar layout save error", err);
        });
    }

    activeOn(filter: string) {
        return this.filters.status === filter ? "active" : "";
    }

    selectStatus(status: string) {
        this.onStatus?.({ status });
    }

    selectLabel(label?: string) {
        this.onLabel?.({ label });
    }

    selectTracker(tracker?: string) {
        this.onTracker?.({ tracker });
    }

    numInStatus(status: string) {
        return Object.values(this.torrents || {}).filter(this.torrentFilter(status)).length;
    }

    private torrentFilter(status: string) {
        const filterLabel = this.filters.label;
        const filterTracker = this.filters.tracker;
        const filters: Array<(torrent: TorrentLike) => boolean> = [
            (torrent) => this.statusFilter(torrent, status),
        ];

        if (filterLabel) {
            filters.push((torrent) => matchesLabelFilter(torrent.label, filterLabel));
        }

        if (filterTracker) {
            filters.push((torrent) => this.trackerFilter(torrent, filterTracker));
        }

        return (torrent: TorrentLike) => filters.every((filter) => filter(torrent));
    }

    private statusFilter(torrent: TorrentLike, status: string) {
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

    private trackerFilter(torrent: TorrentLike, filterTracker: string) {
        return torrent.trackers && torrent.trackers.some((tracker: string) => {
            return tracker && tracker.includes(filterTracker);
        });
    }
}

export class TorrentSidebarDirective implements IDirective {
    restrict = "E";
    scope = {
        settings: "=",
        features: "=",
        torrents: "=",
        filters: "=",
        labels: "=",
        trackers: "=",
        onStatus: "&",
        onLabel: "&",
        onTracker: "&",
    };
    bindToController = true;
    controller = TorrentSidebarController;
    controllerAs = "ctl";
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new TorrentSidebarDirective();
    }
}

torrentApp.directive("torrentSidebar", TorrentSidebarDirective.getInstance())
