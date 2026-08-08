import { CommonModule } from "@angular/common";
import { Component, Inject, Input, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ModalDirective, type ModalRef } from "@renderer/app/directives/modal/modal.directive";
import type { SavedLocationConfig } from "@shared/ipc-contract";
import { SAVED_LOCATION_ICONS } from "./saved-location-icons";

interface SavedLocationModalSettingsService {
    getAllSettingsCopy(): unknown;
    saveAllSettings(): Promise<void>;
}

interface SavedLocationModalRootEvents {
    $broadcast(name: "new:settings", settings: unknown): void;
}

interface SavedLocationModalServer {
    savedLocations?: SavedLocationConfig[];
}

export interface SavedLocationModalOpenOptions {
    autoSave?: boolean;
    onClose?: () => void;
    onSuccess?: (savedLocation: SavedLocationConfig) => void;
    server?: SavedLocationModalServer;
    submitLabel?: string;
    title?: string;
}

const DEFAULT_SAVED_LOCATION_ICON = "folder open";

@Component({
    selector: "saved-location-modal",
    standalone: true,
    imports: [CommonModule, FormsModule, ModalDirective],
    templateUrl: "./saved-location-modal.template.html",
    exportAs: "savedLocationModal",
})
export class SavedLocationModalDirective {
    @Input() modalId = "savedLocationModal";
    @ViewChild(ModalDirective) modalref?: ModalRef;

    readonly icons = SAVED_LOCATION_ICONS;
    path = "";
    selectedIcon = DEFAULT_SAVED_LOCATION_ICON;
    error = "";
    submitLabel = "Save location";
    title = "Add Saved Location";

    private autoSave = false;
    private onClose?: () => void;
    private onSuccess?: (savedLocation: SavedLocationConfig) => void;
    private server?: SavedLocationModalServer;

    constructor(
        @Inject("$rootScope") private readonly rootEvents: SavedLocationModalRootEvents,
        @Inject("settingsService") private readonly settingsService: SavedLocationModalSettingsService,
    ) {}

    open(options: SavedLocationModalOpenOptions = {}): void {
        this.server = options.server;
        this.autoSave = options.autoSave === true;
        this.onClose = options.onClose;
        this.onSuccess = options.onSuccess;
        this.submitLabel = options.submitLabel || "Save location";
        this.title = options.title || "Add Saved Location";
        this.resetForm();
        this.modalref?.showModal();
    }

    close(): void {
        this.modalref?.hideModal();
    }

    onHidden(): void {
        const onClose = this.onClose;
        this.server = undefined;
        this.autoSave = false;
        this.onClose = undefined;
        this.onSuccess = undefined;
        this.submitLabel = "Save location";
        this.title = "Add Saved Location";
        this.resetForm();
        onClose?.();
    }

    selectIcon(icon: string): void {
        this.selectedIcon = icon;
    }

    isIconSelected(icon: string): boolean {
        return this.selectedIcon === icon;
    }

    async addSavedLocation(): Promise<void> {
        const path = this.path.trim();

        if (!this.server) {
            this.error = "A server is required to save locations";
            return;
        }

        if (!path) {
            this.error = "A filesystem path is required";
            return;
        }

        if (!this.selectedIcon) {
            this.error = "An icon must be selected";
            return;
        }

        const savedLocations = this.getSavedLocations();
        if (savedLocations.some((savedLocation) => savedLocation.path === path)) {
            this.error = "That path is already saved for this server";
            return;
        }

        const savedLocation: SavedLocationConfig = {
            path,
            icon: this.selectedIcon,
        };
        savedLocations.push(savedLocation);

        try {
            if (this.autoSave) {
                await this.settingsService.saveAllSettings();
                this.rootEvents.$broadcast("new:settings", this.settingsService.getAllSettingsCopy());
            }

            this.onSuccess?.(savedLocation);
            this.close();
        } catch (error: any) {
            const index = savedLocations.indexOf(savedLocation);
            if (index >= 0) {
                savedLocations.splice(index, 1);
            }
            this.error = error?.message || String(error) || "Failed to save location";
        }
    }

    private getSavedLocations(): SavedLocationConfig[] {
        if (!this.server) {
            return [];
        }

        if (!Array.isArray(this.server.savedLocations)) {
            this.server.savedLocations = [];
        }

        return this.server.savedLocations;
    }

    private resetForm(): void {
        this.path = "";
        this.selectedIcon = DEFAULT_SAVED_LOCATION_ICON;
        this.error = "";
    }
}
