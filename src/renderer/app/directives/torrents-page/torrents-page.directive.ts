import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, Inject, NgZone, OnDestroy } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AddTorrentModalDirective } from "@renderer/app/directives/add-torrent-modal/add-torrent-modal.directive";
import { ActionHeaderDirective } from "@renderer/app/directives/action-header/action-header.directive";
import { ContextMenuIpcComponent } from "@renderer/app/directives/context-menu-ipc/context-menu-ipc.directive";
import { ModalDirective } from "@renderer/app/directives/modal/modal.directive";
import { SearchDirective } from "@renderer/app/directives/search/search.directive";
import { SetLabelModalComponent } from "@renderer/app/directives/set-label-modal/set-label-modal.directive";
import { SetLocationModalDirective } from "@renderer/app/directives/set-location-modal/set-location-modal.directive";
import { SortingDirective, SortHeaderDirective } from "@renderer/app/directives/sorting/sorting.directive";
import { TorrentDetailsPanelDirective } from "@renderer/app/directives/torrent-details-panel/torrent-details-panel.directive";
import { TorrentSetRatioModalDirective } from "@renderer/app/directives/torrent-set-ratio-modal/torrent-set-ratio-modal.directive";
import { TorrentSidebarDirective } from "@renderer/app/directives/torrent-sidebar/torrent-sidebar.directive";
import { TorrentBodyDirective, TorrentRowDirective } from "@renderer/app/directives/torrent-table/torrent-table.directive";
import { TorrentSpeedModalDirective } from "@renderer/app/directives/torrent-speed-modal/torrent-speed-modal.directive";
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope";
import {
    LegacyTimeout,
    PromiseAdapter,
    TorrentControllerScope,
    TorrentsPageController,
} from "./torrents-page.controller";

interface SettingsService {
    getAllSettings(): any;
}

@Component({
    selector: "torrents-page",
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ActionHeaderDirective,
        AddTorrentModalDirective,
        ContextMenuIpcComponent,
        ModalDirective,
        SearchDirective,
        SetLabelModalComponent,
        SetLocationModalDirective,
        SortingDirective,
        SortHeaderDirective,
        TorrentBodyDirective,
        TorrentDetailsPanelDirective,
        TorrentRowDirective,
        TorrentSetRatioModalDirective,
        TorrentSidebarDirective,
        TorrentSpeedModalDirective,
    ],
    templateUrl: "./torrents-page.template.html",
})
export class TorrentsPageDirective implements OnDestroy, TorrentControllerScope {
    [key: string]: any;
    pendingTorrentFiles: any[] = [];
    arrayTorrents: any[] = [];

    private readonly destroyCallbacks: Array<() => void> = [];
    private readonly timeoutAdapter: LegacyTimeout;
    private alternativeSpeedLimitsOverride?: boolean;
    private destroyed = false;
    constructor(
        @Inject("$rootScope") readonly rootScope: ElectorrentRootScope,
        @Inject("notificationService") notifications: any,
        @Inject("settingsService") settingsService: SettingsService,
        zone: NgZone,
        private readonly changeDetector: ChangeDetectorRef,
    ) {
        const timeout = ((callback: () => void, delay = 0) => setTimeout(() => zone.run(callback), delay)) as LegacyTimeout;
        timeout.cancel = (timer) => {
            if (timer !== undefined) clearTimeout(timer);
        };
        this.timeoutAdapter = timeout;

        const promises: PromiseAdapter = {
            when: <T>(value?: T | PromiseLike<T>) => Promise.resolve(value),
            resolve: <T>(value?: T | PromiseLike<T>) => Promise.resolve(value),
            reject: (reason?: unknown) => Promise.reject(reason),
        };

        new TorrentsPageController(
            rootScope,
            this,
            timeout,
            undefined,
            promises,
            undefined,
            notifications,
            settingsService,
        );
    }

    get client(): any {
        return this.rootScope.$btclient;
    }

    get server(): any {
        return this.rootScope.$server;
    }

    $on(name: string, callback: (...args: any[]) => void): () => void {
        const destroy = this.rootScope.$on(name, (...args: any[]) => callback(...args));
        this.destroyCallbacks.push(destroy);
        return destroy;
    }

    $emit(name: string, ...args: any[]): void {
        this.rootScope.$emit(name, ...args);
    }

    $apply(): void {
        if (!this.destroyed) {
            this.changeDetector.detectChanges();
        }
    }

    $applyAsync(): void {
        queueMicrotask(() => this.$apply());
    }

    ngOnDestroy(): void {
        this.destroyed = true;
        this.rootScope.$emit("stop:torrents");
        void window.electorrent.bittorrent.setSelectedTorrents([]);
        this.destroyCallbacks.splice(0).forEach((destroy) => destroy());
        this.timeoutAdapter.cancel(undefined);
    }

    trackTorrent(_index: number, torrent: any): string {
        return torrent.id;
    }

    trackColumn(index: number, column: any): string {
        return column.attribute || column.name || String(index);
    }

    formatBytes(value: unknown, digits = 1): string {
        const bytes = Number(value);
        if (!Number.isFinite(bytes) || bytes < 0) return "";
        if (bytes === 0) return "0 B";
        const units = ["B", "KB", "MB", "GB", "TB", "PB"];
        const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
        return `${parseFloat((bytes / (1024 ** index)).toFixed(digits))} ${units[index]}`;
    }

    formatSpeed(value: unknown): string {
        return `${this.formatBytes(value)}/s`;
    }

    get alternativeSpeedLimitsUiEnabled(): boolean {
        return this.alternativeSpeedLimitsOverride ?? this.alternativeSpeedLimitsEnabled === true;
    }

    toggleAlternativeSpeedLimits(target: HTMLElement): void {
        const enabled = !this.alternativeSpeedLimitsUiEnabled;
        this.alternativeSpeedLimitsOverride = enabled;
        target.classList.toggle("active", enabled);
        this.alternativeSpeedLimitsEnabled = enabled;
        void this.setAlternativeSpeedLimitsMode(enabled);
    }
}

export { TorrentsPageDirective as TorrentsPageComponent };
