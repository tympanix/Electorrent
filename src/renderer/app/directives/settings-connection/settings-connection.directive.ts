import { IDirective, IDirectiveFactory, IScope } from "angular";
import html from "./settings-connection.template.html";

interface SettingsConnectionScope extends IScope {
    noop: () => void;
}

export class SettingsConnectionDirective implements IDirective {
    restrict = "E";
    scope = true;
    template = html;
    controller = ['$scope', ($scope: SettingsConnectionScope) => {
        $scope.noop = angular.noop;
    }];

    static getInstance(): IDirectiveFactory {
        return () => new SettingsConnectionDirective();
    }
}
