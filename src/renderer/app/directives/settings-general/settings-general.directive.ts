import { IDirective, IDirectiveFactory } from "angular";
import { SettingsGeneralController } from "./settings-general.controller";
import html from "./settings-general.template.html";

export class SettingsGeneralDirective implements IDirective {
    restrict = "E";
    scope = {};
    bindToController = {
        settings: "<",
        themes: "<",
        platform: "<",
        general: "<",
    };
    controller = SettingsGeneralController;
    controllerAs = "ctl";
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new SettingsGeneralDirective();
    }
}
