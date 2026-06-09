import { IScope } from "angular";
import type { ColorTheme, ThemePreference } from "@shared/ipc-contract";

interface AppThemeScope extends IScope {
    theme: ColorTheme;
}

export class AppThemeController {
    static $inject = ["$scope", "settingsService"];

    constructor($scope: AppThemeScope, settingsService: any) {
        const electorrent = window.electorrent;
        let systemTheme: ColorTheme = electorrent.app.initialTheme;
        let themePreference: ThemePreference = settingsService.getAllSettings().ui.theme;

        const applyTheme = () => {
            $scope.theme = themePreference === "system" ? systemTheme : themePreference;
        };

        applyTheme();

        const unsubscribeSystemTheme = electorrent.settings.onSystemThemeChanged((theme) => {
            systemTheme = theme;
            applyTheme();
            $scope.$applyAsync();
        });

        settingsService.whenReady().then(() => {
            themePreference = settingsService.getAllSettings().ui.theme;
            applyTheme();
        }).catch(() => {
            // Settings load errors are reported by the application bootstrap.
        }).finally(() => {
            $scope.$applyAsync();
        });

        $scope.$on("new:settings", (_event: unknown, nextSettings: any) => {
            themePreference = nextSettings.ui.theme || themePreference;
            applyTheme();
        });

        $scope.$on("$destroy", () => {
            unsubscribeSystemTheme();
        });
    }
}
