import { IScope } from "angular";

interface AppThemeScope extends IScope {
    theme: string;
}

export class AppThemeController {
    static $inject = ["$scope", "settingsService"];

    constructor($scope: AppThemeScope, settingsService: any) {
        const settings = settingsService.getAllSettings();
        $scope.theme = settings.ui.theme;

        settingsService.whenReady().then(() => {
            $scope.theme = settingsService.getAllSettings().ui.theme;
        }).catch(() => {
            // Settings load errors are reported by the application bootstrap.
        }).finally(() => {
            $scope.$applyAsync();
        });

        $scope.$on("new:settings", (_event: unknown, nextSettings: any) => {
            $scope.theme = nextSettings.ui.theme || $scope.theme;
        });
    }
}
