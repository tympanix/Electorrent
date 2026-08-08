import { Component, DoCheck, HostBinding, Input, OnDestroy } from "@angular/core";

interface ProgressTorrent {
    percent: number;
    getPercentStr(): string;
    isStatusCompleted(): boolean;
    isStatusDownloading(): boolean;
    isStatusSeeding(): boolean;
    statusColor(): string;
    statusText(): string;
}

@Component({
    selector: "[progress]",
    standalone: true,
    templateUrl: "./progress.template.html",
})
export class ProgressDirective implements DoCheck, OnDestroy {
    @Input({ alias: "progress", required: true }) torrent?: ProgressTorrent;

    idle = true;

    private lastPercent?: number;
    private idleTimer?: number;

    @HostBinding("class")
    get classes(): string {
        return ["ui torrent progress", this.torrent?.statusColor()].filter(Boolean).join(" ");
    }

    get label(): string {
        if (!this.torrent) {
            return "";
        }

        let label = this.torrent.statusText();
        if (
            this.torrent.isStatusDownloading()
            || this.torrent.isStatusCompleted()
            || this.torrent.isStatusSeeding()
        ) {
            label += ` ${this.torrent.getPercentStr()}`;
        }

        return label;
    }

    get width(): string {
        return this.torrent?.getPercentStr() ?? "0%";
    }

    ngDoCheck(): void {
        if (!this.torrent || this.torrent.percent === this.lastPercent) {
            return;
        }

        const oldPercent = this.lastPercent;
        this.lastPercent = this.torrent.percent;
        if (this.torrent.percent < 1000 || (oldPercent !== undefined && oldPercent < 1000)) {
            this.activateTransitions();
        }
    }

    ngOnDestroy(): void {
        if (this.idleTimer !== undefined) {
            window.clearTimeout(this.idleTimer);
        }
    }

    private activateTransitions(): void {
        if (!this.idle || this.idleTimer !== undefined) {
            return;
        }

        this.idleTimer = window.setTimeout(() => {
            this.idle = false;
            this.idleTimer = undefined;
        });
    }
}
