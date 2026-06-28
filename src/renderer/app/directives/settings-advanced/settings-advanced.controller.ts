import { IRootScopeService, IScope } from "angular";
import type { LabelColorHue, LabelColorOverrides, SavedLocationConfig, TorrentUploadOptions } from "@shared/ipc-contract";
import { SavedLocationModalController } from "@renderer/app/directives/saved-location-modal/saved-location-modal.controller";
import { LabelColorModalController } from "@renderer/app/directives/label-color-modal/label-color-modal.controller";

interface SettingsAdvancedScope extends IScope {
    server?: {
        id?: string
        savedLocations?: SavedLocationConfig[]
        defaultUploadOptionsEnabled?: boolean
        defaultUploadOptions?: TorrentUploadOptions
        labelColors?: LabelColorOverrides
        getDisplayName?: () => string
    }
}

interface LabelColorService {
    getHue(label?: string, overrides?: LabelColorOverrides): LabelColorHue
}

export class SettingsAdvancedController {
    static $inject = ["$scope", "$rootScope", "labelColorService"];

    savedLocationModalRef: SavedLocationModalController;
    labelColorModalRef: LabelColorModalController;

    constructor(
        private readonly scope: SettingsAdvancedScope,
        private readonly rootScope: IRootScopeService & { currentLabelsByServer?: Record<string, string[]> },
        private readonly labelColorService: LabelColorService,
    ) {}

    hasServer() {
        return !!this.scope.server?.id;
    }

    getServerName() {
        return this.scope.server?.getDisplayName?.() || "current server";
    }

    getLabels() {
        const labels = new Set<string>();

        const serverId = this.scope.server?.id;
        const serverLabels = serverId ? this.rootScope.currentLabelsByServer?.[serverId] || [] : [];

        serverLabels.forEach((label) => {
            if (label) {
                labels.add(label);
            }
        });

        Object.keys(this.getLabelColors()).forEach((label) => labels.add(label));

        return Array.from(labels).sort((left, right) => left.localeCompare(right));
    }

    getLabelColors() {
        if (!this.scope.server) {
            return {};
        }

        if (!this.scope.server.labelColors || typeof this.scope.server.labelColors !== "object") {
            this.scope.server.labelColors = {};
        }

        return this.scope.server.labelColors;
    }

    getLabelHue(label: string) {
        return this.labelColorService.getHue(label, this.getLabelColors());
    }

    hasCustomLabelColor(label: string) {
        return !!this.getLabelColors()[label];
    }

    openLabelColorModal(label: string) {
        if (!this.hasServer()) {
            return;
        }

        this.labelColorModalRef?.open({
            label,
            currentHue: this.getLabelHue(label),
            onSelect: (hue) => {
                this.getLabelColors()[label] = hue;
            },
        });
    }

    resetLabelColor(label: string) {
        delete this.getLabelColors()[label];
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
}
