import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ToggleDirective } from "@renderer/app/directives/checkbox/checkbox.directive";
import {
    DropdownDirective,
    DropdownItemDirective,
} from "@renderer/app/directives/dropdown/dropdown.directive";
import type { AppSettings, ThemeInfo } from "@shared/ipc-contract";
import { createDefaultSettings } from "@shared/settings-defaults";

export interface SettingsGeneralPlatform {
    linux(): boolean;
    macOS(): boolean;
    windows(): boolean;
}

export interface GeneralIntegrationSettings {
    magnets: boolean;
}

const UNKNOWN_PLATFORM: SettingsGeneralPlatform = {
    linux: () => false,
    macOS: () => false,
    windows: () => false,
};

@Component({
    selector: "settings-general",
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        DropdownDirective,
        DropdownItemDirective,
        ToggleDirective,
    ],
    templateUrl: "./settings-general.template.html",
})
export class SettingsGeneralComponent {
    @Input() settings: AppSettings<any> = createDefaultSettings();
    @Input() themes: ThemeInfo[] = [];
    @Input() platform: SettingsGeneralPlatform = UNKNOWN_PLATFORM;
    @Input() general: GeneralIntegrationSettings = { magnets: false };

    trackTheme(_index: number, theme: ThemeInfo): string {
        return theme.basename;
    }
}

// Transitional alias for imports that still use the old directive name.
export { SettingsGeneralComponent as SettingsGeneralDirective };
