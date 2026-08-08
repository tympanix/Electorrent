import { Directive, ElementRef, Inject, OnDestroy, OnInit } from "@angular/core";
import type { ColorTheme, ThemePreference } from "@shared/ipc-contract";

interface AppThemeSettingsService {
    getAllSettings(): {
        ui: {
            theme: ThemePreference;
        };
    };
    whenReady(): Promise<unknown>;
}

interface AppThemeRootEvents {
    $on(
        name: "new:settings",
        callback: (event: unknown, settings: AppThemeSettings) => void,
    ): () => void;
}

interface AppThemeSettings {
    ui?: {
        theme?: ThemePreference;
    };
}

@Directive({
    selector: "[app-theme]",
    standalone: true,
})
export class AppThemeDirective implements OnInit, OnDestroy {
    private readonly electorrent = window.electorrent;
    private readonly destroyCallbacks: Array<() => void> = [];
    private systemTheme: ColorTheme = this.electorrent.app.initialTheme;
    private themePreference: ThemePreference;
    private destroyed = false;

    constructor(
        @Inject("settingsService") private readonly settingsService: AppThemeSettingsService,
        @Inject("$rootScope") private readonly rootEvents: AppThemeRootEvents,
        private readonly head: ElementRef<HTMLHeadElement>,
    ) {
        this.themePreference = this.settingsService.getAllSettings().ui.theme;
    }

    ngOnInit(): void {
        this.applyTheme();

        this.destroyCallbacks.push(
            this.electorrent.settings.onSystemThemeChanged((theme) => {
                this.systemTheme = theme;
                this.applyTheme();
            }),
            this.rootEvents.$on("new:settings", (_event, settings) => {
                this.themePreference = settings.ui?.theme ?? this.themePreference;
                this.applyTheme();
            }),
        );

        this.settingsService.whenReady().then(() => {
            if (this.destroyed) {
                return;
            }

            this.themePreference = this.settingsService.getAllSettings().ui.theme;
            this.applyTheme();
        }).catch(() => {
            // Settings load errors are reported by the application bootstrap.
        });
    }

    ngOnDestroy(): void {
        this.destroyed = true;
        this.destroyCallbacks.splice(0).forEach((destroy) => destroy());
    }

    private applyTheme(): void {
        const theme = this.themePreference === "system" ? this.systemTheme : this.themePreference;
        const stylesheet = this.head.nativeElement.querySelector<HTMLLinkElement>('link[href*="css/themes/"]');
        stylesheet?.setAttribute("href", `css/themes/${theme}.css`);
    }
}
