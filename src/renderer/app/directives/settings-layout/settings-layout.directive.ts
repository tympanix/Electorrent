import { IDirective, IDirectiveFactory } from "angular";
import { SettingsLayoutController } from "./settings-layout.controller";
import html from "./settings-layout.template.html";

export class SettingsLayoutDirective implements IDirective {
    restrict = "E";
    scope = {};
    bindToController = {
        server: "<",
        sortOptions: "<",
    };
    controller = SettingsLayoutController;
    controllerAs = "ctl";
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new SettingsLayoutDirective();
    }
}
