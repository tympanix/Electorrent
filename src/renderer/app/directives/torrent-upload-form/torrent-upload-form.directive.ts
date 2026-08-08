import { CommonModule } from "@angular/common";
import {
    ChangeDetectorRef,
    Component,
    DoCheck,
    EventEmitter,
    Inject,
    Input,
    OnDestroy,
    OnInit,
    Output,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ToggleComponent } from "@renderer/app/directives/checkbox/checkbox.directive";
import { DropdownDirective, DropdownItemDirective } from "@renderer/app/directives/dropdown/dropdown.directive";
import type { TorrentUploadOptions } from "@shared/ipc-contract";
import {
    TorrentUploadFormController,
    TorrentUploadRootScope,
    TorrentUploadSettingsService,
} from "./torrent-upload-form.controller";

@Component({
    selector: "torrent-upload-form",
    standalone: true,
    imports: [CommonModule, FormsModule, DropdownDirective, DropdownItemDirective, ToggleComponent],
    templateUrl: "./torrent-upload-form.template.html",
})
export class TorrentUploadFormDirective extends TorrentUploadFormController implements DoCheck, OnDestroy, OnInit {
    @Input() labels: string[] = [];
    @Input() loading = false;
    @Input() override canAddSavedLocation = false;
    @Output() readonly addSavedLocation = new EventEmitter<void>();
    @Output() readonly optionsChange = new EventEmitter<TorrentUploadOptions>();

    private previousClient?: unknown;
    private previousServerId?: string;
    private previousSaveLocation?: string;
    private offSettings?: () => void;

    constructor(
        @Inject("$rootScope") rootScope: TorrentUploadRootScope,
        @Inject("settingsService") settingsService: TorrentUploadSettingsService,
        private readonly changeDetector: ChangeDetectorRef,
    ) {
        super(rootScope, settingsService);
    }

    @Input()
    override set options(value: TorrentUploadOptions | null | undefined) {
        this.uploadOptions = value || {};
        this.syncSelectedSavedLocation();
    }

    override get options(): TorrentUploadOptions {
        return this.uploadOptions;
    }

    ngOnInit(): void {
        this.refreshFormState();
        this.captureObservedState();
        this.offSettings = this.rootScope.$on("new:settings", () => {
            this.refreshSavedLocations();
            this.changeDetector.markForCheck();
        });
    }

    ngDoCheck(): void {
        const client = this.rootScope.$btclient;
        const serverId = this.rootScope.$server?.id;
        const saveLocation = this.options.saveLocation;

        if (client !== this.previousClient) {
            this.refreshFormState();
        } else if (serverId !== this.previousServerId) {
            this.refreshSavedLocations();
        } else if (saveLocation !== this.previousSaveLocation) {
            this.syncSelectedSavedLocation();
        }

        this.captureObservedState();
    }

    ngOnDestroy(): void {
        this.offSettings?.();
    }

    override applySelectedSavedLocation(): void {
        super.applySelectedSavedLocation();
        this.emitOptionsChange();
    }

    hasSavedLocationAction(): boolean {
        return this.addSavedLocation.observed;
    }

    canOpenSavedLocationModal(): boolean {
        return this.canAddSavedLocation && this.hasSavedLocationAction();
    }

    openSavedLocationModal(): void {
        if (this.canOpenSavedLocationModal()) {
            this.addSavedLocation.emit();
        }
    }

    clearCategory(): void {
        this.options.category = null;
        this.emitOptionsChange();
    }

    emitOptionsChange(): void {
        this.optionsChange.emit(this.options);
    }

    trackSavedLocation(_index: number, savedLocation: { path: string }): string {
        return savedLocation.path;
    }

    trackLabel(_index: number, label: string): string {
        return label;
    }

    private captureObservedState(): void {
        this.previousClient = this.rootScope.$btclient;
        this.previousServerId = this.rootScope.$server?.id;
        this.previousSaveLocation = this.options.saveLocation;
    }
}

export { TorrentUploadFormDirective as TorrentUploadFormComponent };
