import { IDirective, IDirectiveFactory } from "angular";
import { SettingsConnectionController } from "./settings-connection.controller";
import html from "./settings-connection.template.html";

export class SettingsConnectionDirective implements IDirective {
    restrict = "E";
    scope = {};
    bindToController = {
        server: "<",
        btclients: "<",
        connecting: "<",
    };
    controller = SettingsConnectionController;
    controllerAs = "ctl";
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new SettingsConnectionDirective();
    }
}
