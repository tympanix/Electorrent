import { IScope } from "angular";
import type { SavedLocationConfig, TorrentUploadOptions } from "@shared/ipc-contract";
import { SavedLocationModalController } from "@renderer/app/directives/saved-location-modal/saved-location-modal.controller";
import type { LabelColorService } from "@renderer/app/services/label-color";

interface SettingsAdvancedScope extends IScope {
    server?: {
        id?: string
        savedLocations?: SavedLocationConfig[]
        defaultUploadOptionsEnabled?: boolean
        defaultUploadOptions?: TorrentUploadOptions
        labelColors?: Record<string, string>
        getDisplayName?: () => string
    }
    labelColorModal?: {
        label: string
        selectedColor: string
    }
}

export class SettingsAdvancedController {
    static $inject = ["$scope", "$rootScope", "labelColorService"];

    savedLocationModalRef: SavedLocationModalController;

    constructor(
        private readonly scope: SettingsAdvancedScope,
        private readonly rootScope: angular.IRootScopeService,
        private readonly labelColorService: LabelColorService,
    ) {}

    hasServer() {
        return !!this.scope.server?.id;
    }

    getServerName() {
        return this.scope.server?.getDisplayName?.() || "current server";
    }

    getSavedLocations() {
        if (!this.scope.server) {
            return [];
        }

        if (!Array.isArray(this.scope.server.savedLocations)) {
            this.scope.server.savedLocations = [];
        }

        return this.scope.server.savedLocations;
    }

    openSavedLocationModal() {
        if (!this.hasServer()) {
            return;
        }

        this.savedLocationModalRef?.open({
            autoSave: false,
            server: this.scope.server,
        });
    }

    removeSavedLocation(path: string) {
        if (!this.scope.server) {
            return;
        }

        this.scope.server.savedLocations = this.getSavedLocations().filter((savedLocation) => savedLocation.path !== path);
    }

    getLabels() {
        const knownLabels = (this.rootScope as any).$labels || [];
        const customizedLabels = Object.keys(this.scope.server?.labelColors || {});
        return Array.from(new Set([...knownLabels, ...customizedLabels])).sort();
    }

    getPalette() {
        return this.labelColorService.getPalette();
    }

    getLabelColor(label: string) {
        return this.labelColorService.getColor(this.scope.server, label);
    }

    getLabelColorStyle(label: string) {
        return this.labelColorService.style(this.scope.server, label);
    }

    getColorSwatchStyle(color: string) {
        return {
            backgroundColor: color,
            borderColor: color,
        };
    }

    openLabelColorModal(label: string) {
        this.scope.labelColorModal = {
            label,
            selectedColor: this.getLabelColor(label),
        };

        const modal: any = $("#settingsLabelColorModal");
        modal.modal("show");
    }

    selectLabelColor(color: string) {
        if (!this.scope.labelColorModal) {
            return;
        }

        this.scope.labelColorModal.selectedColor = color;
    }

    saveLabelColor() {
        if (!this.scope.labelColorModal) {
            return false;
        }

        this.labelColorService.setColor(
            this.scope.server,
            this.scope.labelColorModal.label,
            this.scope.labelColorModal.selectedColor,
        );
        return true;
    }
}
