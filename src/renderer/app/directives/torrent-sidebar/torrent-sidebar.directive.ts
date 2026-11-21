import { IDirective, IDirectiveFactory } from "angular";
import { NO_LABEL_FILTER } from "./torrent-label-filter";
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

export class TorrentSidebarController {
    settings!: TorrentSidebarSettings;
    features: TorrentSidebarFeatures = {};
    /** Torrent count per status, precomputed by the torrents page whenever the list changes. */
    counts: Record<string, number> = {};
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
        return this.counts?.[status] ?? 0;
    }
}

export class TorrentSidebarDirective implements IDirective {
    restrict = "E";
    scope = {
        settings: "=",
        features: "=",
        counts: "=",
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
