import { IAttributes, IAugmentedJQuery, IDirective, IDirectiveFactory, IParseService, IScope } from "angular";
import { RightClickController } from "./right-click.controller";

export class RightClickDirective implements IDirective {
    controller = RightClickController;

    static getInstance(): IDirectiveFactory {
        const factory = ($parse: IParseService) => new RightClickDirective($parse);
        factory.$inject = ["$parse"];
        return factory;
    }

    constructor(private $parse: IParseService) {}

    link(scope: IScope, element: IAugmentedJQuery, attrs: IAttributes) {
        const fn = this.$parse(attrs.ngRightClick);
        element.on("contextmenu", (event: JQuery.TriggeredEvent) => {
            scope.$apply(() => {
                event.preventDefault();
                fn(scope, { $event: event });
            });
        });
    }
}
