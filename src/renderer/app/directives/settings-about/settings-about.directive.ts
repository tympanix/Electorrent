import { IDirective, IDirectiveFactory } from "angular";
import { SettingsAboutController } from "./settings-about.controller";
import html from "./settings-about.template.html";

export class SettingsAboutDirective implements IDirective {
    restrict = "E";
    scope = {};
    bindToController = {
        appVersion: "<",
        nodeVersion: "<",
        chromeVersion: "<",
        electronVersion: "<",
    };
    controller = SettingsAboutController;
    controllerAs = "ctl";
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new SettingsAboutDirective();
    }
}
