import { IAugmentedJQuery, IDirective, IDirectiveFactory, IRootScopeService, IScope } from "angular";
import { SearchController } from "./search.controller";

export class SearchDirective implements IDirective {
    restrict = "A";
    controller = SearchController;

    static getInstance(): IDirectiveFactory {
        const factory = ($rootScope: IRootScopeService) => new SearchDirective($rootScope);
        factory.$inject = ["$rootScope"];
        return factory;
    }

    constructor(private $rootScope: IRootScopeService) {}

    link(scope: IScope, element: IAugmentedJQuery) {
        element.on("keyup", (event: JQuery.KeyUpEvent) => {
            if (event.keyCode === 27) {
                (element[0] as HTMLInputElement).blur();
            }
        });

        const unsubscribe = this.$rootScope.$on("search:torrent", () => {
            const input = element[0] as HTMLInputElement;
            input.focus();
            input.select();
        });

        scope.$on("$destroy", unsubscribe);
    }
}
