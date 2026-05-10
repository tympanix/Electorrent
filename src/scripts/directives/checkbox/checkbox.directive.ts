import { IDirective, IDirectiveFactory } from "angular";
import { ToggleController } from "./checkbox.controller";
import html from "./checkbox.template.html";

export class ToggleDirective implements IDirective {
    restrict = "E";
    replace = true;
    transclude = true;
    scope = {
        ngChange: "&?ngChange",
        checked: "&?",
        disabled: "&?",
        ngModel: "=ngModel",
    };
    bindToController = true;
    require = "ngModel";
    controller = ToggleController;
    controllerAs = "vm";
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new ToggleDirective();
    }
}
