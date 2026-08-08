import { CommonModule } from "@angular/common";
import {
    Component,
    Inject,
    Input,
    OnChanges,
    OnDestroy,
    Optional,
} from "@angular/core";
import type {
    TorrentDetailsInfoField,
    TorrentDetailsInfoSection,
} from "@renderer/app/bittorrent/torrentclient";
import moment from "moment";

interface DetailsTorrent {
    id: string;
}

interface DetailsClient {
    getTorrentDetails(torrent: DetailsTorrent): Promise<{
        sections?: TorrentDetailsInfoSection[];
    } | null | undefined>;
}

interface DetailsRootState {
    $btclient?: DetailsClient | null;
}

const MONTH_IN_SECONDS = 60 * 60 * 24 * 30;

@Component({
    selector: "torrent-details-info-tab",
    standalone: true,
    imports: [CommonModule],
    templateUrl: "./torrent-details-info-tab.template.html",
})
export class TorrentDetailsInfoTabComponent implements OnChanges, OnDestroy {
    @Input() torrent?: DetailsTorrent;
    @Input() refresh = 0;
    @Input() client?: DetailsClient;

    sections: TorrentDetailsInfoSection[] = [];
    loading = false;
    loaded = false;
    error: string | null = null;

    private requestId = 0;
    private torrentId?: string;

    constructor(
        @Optional() @Inject("$rootScope") private readonly rootState: DetailsRootState | null,
    ) {}

    ngOnChanges(): void {
        void this.load();
    }

    ngOnDestroy(): void {
        this.requestId += 1;
    }

    formatFieldValue(field: TorrentDetailsInfoField): string {
        switch (field.format) {
            case "bytes":
                return this.formatBytes(field.value);
            case "speed":
                return `${this.formatBytes(field.value)}/s`;
            case "speedLimit":
                return this.formatSpeedLimit(field.value);
            case "ratio": {
                const value = Number(field.value);
                return Number.isFinite(value) ? value.toFixed(2) : "";
            }
            case "eta":
                return this.formatEta(field.value);
            case "epoch":
                return this.formatEpoch(field.value);
            case "boolean":
                return field.value ? "Yes" : "No";
            case "number":
                return String(field.value);
            case "percent":
                return this.formatPercent(field.value);
            case "path":
            case "text":
            default:
                return field.value == null ? "" : String(field.value);
        }
    }

    fieldTitle(field: TorrentDetailsInfoField): string {
        return field.multiline || field.format === "path" ? this.formatFieldValue(field) : "";
    }

    copyFieldValue(field: TorrentDetailsInfoField): Promise<void> {
        return window.electorrent.clipboard.writeText(this.formatFieldValue(field));
    }

    sectionIcon(sectionId: string): string {
        const icons: Record<string, string> = {
            overview: "info circle",
            transfer: "exchange",
            swarm: "users",
            content: "file alternate outline",
            dates: "calendar alternate outline",
        };
        return icons[sectionId] || "list alternate outline";
    }

    trackSection(_index: number, section: TorrentDetailsInfoSection): string {
        return section.id;
    }

    trackField(_index: number, field: TorrentDetailsInfoField): string {
        return field.id;
    }

    private async load(): Promise<void> {
        const torrent = this.torrent;
        if (!torrent) return;

        if (this.torrentId !== torrent.id) {
            this.torrentId = torrent.id;
            this.sections = [];
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
            const data = await client.getTorrentDetails(torrent);
            if (!this.isCurrentRequest(requestId, torrent)) return;

            this.sections = data?.sections || [];
            this.loaded = true;
        } catch (error) {
            if (this.isCurrentRequest(requestId, torrent) && !this.loaded) {
                const message = error && typeof error === "object" && "message" in error
                    ? String(error.message)
                    : "";
                this.error = message || "Failed to load torrent info";
            }
        } finally {
            if (this.isCurrentRequest(requestId, torrent)) {
                this.loading = false;
            }
        }
    }

    private isCurrentRequest(requestId: number, torrent: DetailsTorrent): boolean {
        return requestId === this.requestId && this.torrent === torrent;
    }

    private formatBytes(value: unknown, fractionSize = 1): string {
        if (value === null || value === undefined) return "";

        const bytes = Number(value);
        if (!Number.isFinite(bytes) || bytes < 0) return "";
        if (bytes === 0) return "0 B";

        const unit = 1024;
        const decimals = fractionSize < 0 ? 0 : fractionSize;
        const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
        const index = Math.floor(Math.log(bytes) / Math.log(unit));
        return `${parseFloat((bytes / Math.pow(unit, index)).toFixed(decimals))} ${sizes[index]}`;
    }

    private formatSpeedLimit(value: unknown): string {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return "";
        return numeric <= 0 ? "∞" : `${this.formatBytes(numeric)}/s`;
    }

    private formatEta(value: unknown): string {
        const seconds = Number(value);
        if (!seconds || seconds < 1 || seconds > MONTH_IN_SECONDS) return "";
        return moment().to(moment().add(seconds, "seconds"), true);
    }

    private formatEpoch(value: unknown): string {
        if (value instanceof Date) return "Unknown date";

        const epoch = Number(value);
        return epoch ? moment(epoch * 1000).format("MMMM Do YYYY, HH:mm") : "Unknown date";
    }

    private formatPercent(value: unknown): string {
        const numeric = typeof value === "number" ? value : Number(value);
        return Number.isFinite(numeric) && numeric >= 0 ? `${(numeric * 100).toFixed(1)}%` : "";
    }
}

// Transitional alias for imports that still use the old directive name.
export { TorrentDetailsInfoTabComponent as TorrentDetailsInfoTabDirective };
