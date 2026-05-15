import { IScope } from "angular";

interface AppThemeScope extends IScope {
    theme: string;
}

export class AppThemeController {
    static $inject = ["$scope", "settingsService"];

    constructor($scope: AppThemeScope, settingsService: any) {
        const settings = settingsService.getAllSettings();
        $scope.theme = settings.ui.theme;

        $scope.$on("new:settings", (e: unknown, nextSettings: any) => {
            $scope.theme = nextSettings.ui.theme || $scope.theme;
        });
    }
}
