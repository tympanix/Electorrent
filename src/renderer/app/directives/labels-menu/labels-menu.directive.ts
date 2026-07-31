import { IDirective, IDirectiveFactory } from "angular";
import { LabelsMenuController } from "./labels-menu.controller";
import html from "./labels-menu.template.html";

export class LabelsMenuDirective implements IDirective {
    restrict = "E";
    scope = {};
    bindToController = {
        enabled: "<",
        action: "<",
        labels: "<",
    };
    controller = LabelsMenuController;
    controllerAs = "ctl";
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new LabelsMenuDirective();
    }
}
