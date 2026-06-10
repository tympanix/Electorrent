import { IScope } from "angular";
import { TorrentUploadOptions, TorrentUploadOptionsEnable } from "@renderer/app/bittorrent/torrentclient";
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope";
import type { SavedLocationConfig } from "@shared/ipc-contract";

interface TorrentUploadFormScope extends IScope {
    options: TorrentUploadOptions
    canAddSavedLocation?: boolean
    onAddSavedLocation?: () => void
}

export class TorrentUploadFormController {

    static $inject = ["$scope", "$rootScope", "settingsService"]

    scope: TorrentUploadFormScope
    rootScope: ElectorrentRootScope
    optionsEnabled: TorrentUploadOptionsEnable = {}
    savedLocations: SavedLocationConfig[] = []
    selectedSavedLocationPath = ""

    constructor(scope: TorrentUploadFormScope, rootScope: ElectorrentRootScope, private readonly settingsService: { getServer: (id: string) => { savedLocations?: SavedLocationConfig[] } | undefined }) {
        this.scope = scope
        this.rootScope = rootScope
        this.refreshFormState()

        scope.$watch(() => {
            return this.rootScope.$btclient
        }, () => {
            this.refreshFormState()
        })

        scope.$watch(() => {
            return this.rootScope.$server?.id
        }, () => {
            this.refreshSavedLocations()
        })

        scope.$watch(() => {
            return this.scope.options?.saveLocation
        }, () => {
            this.syncSelectedSavedLocation()
        })

        const off = this.rootScope.$on("new:settings", () => {
            this.refreshSavedLocations()
            this.scope.$applyAsync()
        })

        scope.$on("$destroy", () => {
            off()
        })
    }

    refreshFormState() {
        this.optionsEnabled = this.rootScope?.$btclient?.features.uploadOptions || {}
        this.refreshSavedLocations()
    }

    refreshSavedLocations() {
        const serverId = this.rootScope.$server?.id
        const server = serverId ? this.settingsService.getServer(serverId) : undefined
        this.savedLocations = Array.isArray(server?.savedLocations) ? server.savedLocations : []
        this.syncSelectedSavedLocation()
    }

    applySelectedSavedLocation() {
        if (!this.scope.options) {
            return
        }

        this.scope.options.saveLocation = this.selectedSavedLocationPath || ""
    }

    syncSelectedSavedLocation() {
        const saveLocation = this.scope.options?.saveLocation || ""
        const selectedSavedLocation = this.savedLocations.find((savedLocation) => savedLocation.path === saveLocation)
        this.selectedSavedLocationPath = selectedSavedLocation?.path || ""
    }

    getSelectedSavedLocation() {
        return this.savedLocations.find((savedLocation) => savedLocation.path === this.selectedSavedLocationPath)
    }

    hasSavedLocationAction() {
        return typeof this.scope.onAddSavedLocation === "function"
    }

    canOpenSavedLocationModal() {
        return !!this.scope.canAddSavedLocation && this.hasSavedLocationAction()
    }

    openSavedLocationModal() {
        if (!this.canOpenSavedLocationModal() || !this.scope.onAddSavedLocation) {
            return
        }

        this.scope.onAddSavedLocation()
    }

}
