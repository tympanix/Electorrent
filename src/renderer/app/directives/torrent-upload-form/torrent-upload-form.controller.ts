import type { TorrentUploadOptions, TorrentUploadOptionsEnable } from "@shared/ipc-contract";
import type { SavedLocationConfig } from "@shared/ipc-contract";

export interface TorrentUploadRootScope {
    $btclient?: {
        features?: {
            uploadOptions?: TorrentUploadOptionsEnable;
        };
    };
    $server?: { id?: string };
    $on(event: string, listener: () => void): () => void;
}

export interface TorrentUploadSettingsService {
    getServer(id: string): { savedLocations?: SavedLocationConfig[] } | undefined;
}

export class TorrentUploadFormController {
    protected uploadOptions: TorrentUploadOptions = {};
    canAddSavedLocation = false;
    optionsEnabled: TorrentUploadOptionsEnable = {};
    savedLocations: SavedLocationConfig[] = [];
    selectedSavedLocationPath = "";

    constructor(
        protected readonly rootScope: TorrentUploadRootScope,
        protected readonly settingsService: TorrentUploadSettingsService,
    ) {}

    set options(value: TorrentUploadOptions | null | undefined) {
        this.uploadOptions = value || {};
    }

    get options(): TorrentUploadOptions {
        return this.uploadOptions;
    }

    refreshFormState(): void {
        this.optionsEnabled = this.rootScope.$btclient?.features?.uploadOptions || {};
        this.refreshSavedLocations();
    }

    refreshSavedLocations(): void {
        const serverId = this.rootScope.$server?.id;
        const server = serverId ? this.settingsService.getServer(serverId) : undefined;
        this.savedLocations = Array.isArray(server?.savedLocations) ? server.savedLocations : [];
        this.syncSelectedSavedLocation();
    }

    applySelectedSavedLocation(): void {
        this.options.saveLocation = this.selectedSavedLocationPath || "";
    }

    syncSelectedSavedLocation(): void {
        const saveLocation = this.options.saveLocation || "";
        const selectedSavedLocation = this.savedLocations.find(({ path }) => path === saveLocation);
        this.selectedSavedLocationPath = selectedSavedLocation?.path || "";
    }

    getSelectedSavedLocation(): SavedLocationConfig | undefined {
        return this.savedLocations.find(({ path }) => path === this.selectedSavedLocationPath);
    }
}
