import { IScope } from "angular";
import type { SavedLocationConfig } from "@shared/ipc-contract";
import { SavedLocationModalController } from "@renderer/app/directives/saved-location-modal/saved-location-modal.controller";

interface SettingsAdvancedScope extends IScope {
    server?: {
        savedLocations?: SavedLocationConfig[]
        getDisplayName?: () => string
    }
}

export class SettingsAdvancedController {
    static $inject = ["$scope"];

    savedLocationModalRef: SavedLocationModalController;

    constructor(private readonly scope: SettingsAdvancedScope) {}

    hasServer() {
        return !!this.scope.server;
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
}
