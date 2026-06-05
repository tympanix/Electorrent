import { IRootScopeService, IScope } from "angular";
import { ModalController } from "@renderer/app/directives/modal/modal.controller";
import type { SavedLocationConfig } from "@shared/ipc-contract";
import { SAVED_LOCATION_ICONS } from "./saved-location-icons";

interface SavedLocationModalScope extends IScope {
    modalId?: string
}

interface SavedLocationModalServer {
    savedLocations?: SavedLocationConfig[]
}

export interface SavedLocationModalOpenOptions {
    autoSave?: boolean
    onClose?: () => void
    onSuccess?: (savedLocation: SavedLocationConfig) => void
    server?: SavedLocationModalServer
    submitLabel?: string
    title?: string
}

const DEFAULT_SAVED_LOCATION_ICON = "folder open";

export class SavedLocationModalController {
    static $inject = ["$scope", "$rootScope", "settingsService"];

    modalref: ModalController;
    readonly icons = SAVED_LOCATION_ICONS;
    readonly modalId: string;
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
        private readonly scope: SavedLocationModalScope,
        private readonly rootScope: IRootScopeService,
        private readonly settingsService: { getAllSettingsCopy: () => unknown, saveAllSettings: () => Promise<void> },
    ) {
        this.modalId = scope.modalId || "savedLocationModal";
    }

    open(options: SavedLocationModalOpenOptions = {}) {
        this.server = options.server;
        this.autoSave = options.autoSave === true;
        this.onClose = options.onClose;
        this.onSuccess = options.onSuccess;
        this.submitLabel = options.submitLabel || "Save location";
        this.title = options.title || "Add Saved Location";
        this.resetForm();
        this.modalref?.showModal();
    }

    close() {
        this.modalref?.hideModal();
    }

    onHidden() {
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

    selectIcon(icon: string) {
        this.selectedIcon = icon;
    }

    isIconSelected(icon: string) {
        return this.selectedIcon === icon;
    }

    async addSavedLocation() {
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

        const savedLocation = {
            path,
            icon: this.selectedIcon,
        };

        savedLocations.push(savedLocation);

        try {
            if (this.autoSave) {
                await this.settingsService.saveAllSettings();
                this.rootScope.$broadcast("new:settings", this.settingsService.getAllSettingsCopy());
            }

            this.onSuccess?.(savedLocation);
            this.close();
        } catch (err: any) {
            const index = savedLocations.indexOf(savedLocation);
            if (index >= 0) {
                savedLocations.splice(index, 1);
            }
            this.error = err?.message || String(err) || "Failed to save location";
        } finally {
            this.scope.$applyAsync();
        }
    }

    private getSavedLocations() {
        if (!this.server) {
            return [];
        }

        if (!Array.isArray(this.server.savedLocations)) {
            this.server.savedLocations = [];
        }

        return this.server.savedLocations;
    }

    private resetForm() {
        this.path = "";
        this.selectedIcon = DEFAULT_SAVED_LOCATION_ICON;
        this.error = "";
    }
}
