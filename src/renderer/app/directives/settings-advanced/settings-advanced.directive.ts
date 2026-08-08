import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Inject, Input, Output, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ToggleComponent } from "@renderer/app/directives/checkbox/checkbox.directive";
import { LabelChipDirective } from "@renderer/app/directives/label-chip/label-chip.directive";
import { LabelColorModalDirective } from "@renderer/app/directives/label-color-modal/label-color-modal.directive";
import { SavedLocationModalDirective } from "@renderer/app/directives/saved-location-modal/saved-location-modal.directive";
import { TorrentUploadFormDirective } from "@renderer/app/directives/torrent-upload-form/torrent-upload-form.directive";
import type { LabelColorHue, LabelColorOverrides, SavedLocationConfig, TorrentUploadOptions } from "@shared/ipc-contract";

export interface SettingsAdvancedSettings {
    watchDirectory?: string;
}

export interface SettingsAdvancedServer {
    id?: string;
    savedLocations?: SavedLocationConfig[];
    defaultUploadOptionsEnabled?: boolean;
    defaultUploadOptions?: TorrentUploadOptions;
    labelColors?: LabelColorOverrides;
    getDisplayName?(): string;
}

interface SettingsAdvancedRootEvents {
    currentLabelsByServer?: Record<string, string[]>;
}

interface LabelColorService {
    getHue(label?: string, overrides?: LabelColorOverrides): LabelColorHue;
}

@Component({
    selector: "settings-advanced",
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        LabelChipDirective,
        LabelColorModalDirective,
        SavedLocationModalDirective,
        ToggleComponent,
        TorrentUploadFormDirective,
    ],
    templateUrl: "./settings-advanced.template.html",
})
export class SettingsAdvancedDirective {
    @Input() settings: SettingsAdvancedSettings = {};
    @Input() server?: SettingsAdvancedServer;
    @Input() labels: string[] = [];
    @Output() settingsChange = new EventEmitter<SettingsAdvancedSettings>();
    @Output() serverChange = new EventEmitter<SettingsAdvancedServer>();

    @ViewChild(SavedLocationModalDirective) savedLocationModalRef?: SavedLocationModalDirective;
    @ViewChild(LabelColorModalDirective) labelColorModalRef?: LabelColorModalDirective;

    constructor(
        @Inject("$rootScope") private readonly rootEvents: SettingsAdvancedRootEvents,
        @Inject("labelColorService") private readonly labelColorService: LabelColorService,
    ) {}

    hasServer(): boolean {
        return !!this.server?.id;
    }

    getServerName(): string {
        return this.server?.getDisplayName?.() || "current server";
    }

    getLabels(): string[] {
        const labels = new Set<string>();
        const serverId = this.server?.id;
        const serverLabels = serverId ? this.rootEvents.currentLabelsByServer?.[serverId] || [] : [];

        serverLabels.forEach((label) => {
            if (label) {
                labels.add(label);
            }
        });

        return Array.from(labels).sort((left, right) => left.localeCompare(right));
    }

    getLabelColors(): LabelColorOverrides {
        if (!this.server) {
            return {};
        }

        if (!this.server.labelColors || typeof this.server.labelColors !== "object") {
            this.server.labelColors = {};
        }

        return this.server.labelColors;
    }

    getLabelHue(label: string): LabelColorHue {
        return this.labelColorService.getHue(label, this.getLabelColors());
    }

    hasCustomLabelColor(label: string): boolean {
        return !!this.getLabelColors()[label];
    }

    openLabelColorModal(label: string): void {
        if (!this.hasServer()) {
            return;
        }

        this.labelColorModalRef?.open({
            label,
            currentHue: this.getLabelHue(label),
            onSelect: (hue) => {
                this.getLabelColors()[label] = hue;
                this.emitServerChange();
            },
        });
    }

    resetLabelColor(label: string): void {
        delete this.getLabelColors()[label];
        this.emitServerChange();
    }

    getSavedLocations(): SavedLocationConfig[] {
        if (!this.server) {
            return [];
        }

        if (!Array.isArray(this.server.savedLocations)) {
            this.server.savedLocations = [];
        }

        return this.server.savedLocations;
    }

    openSavedLocationModal(): void {
        if (!this.hasServer()) {
            return;
        }

        this.savedLocationModalRef?.open({
            autoSave: false,
            server: this.server,
            onSuccess: () => this.emitServerChange(),
        });
    }

    removeSavedLocation(path: string): void {
        if (!this.server) {
            return;
        }

        this.server.savedLocations = this.getSavedLocations()
            .filter((savedLocation) => savedLocation.path !== path);
        this.emitServerChange();
    }

    setWatchDirectory(watchDirectory: string): void {
        this.settings.watchDirectory = watchDirectory;
        this.settingsChange.emit(this.settings);
    }

    async chooseWatchDirectory(): Promise<void> {
        const watchDirectory = await window.electorrent.settings.chooseWatchDirectory(this.settings.watchDirectory);
        if (watchDirectory) {
            this.setWatchDirectory(watchDirectory);
        }
    }

    clearWatchDirectory(): void {
        this.setWatchDirectory("");
    }

    setDefaultUploadOptionsEnabled(enabled: boolean): void {
        if (!this.server) {
            return;
        }

        this.server.defaultUploadOptionsEnabled = enabled;
        this.emitServerChange();
    }

    private emitServerChange(): void {
        if (this.server) {
            this.serverChange.emit(this.server);
        }
    }
}
