import { IDirective, IDirectiveFactory } from "angular";
import html from "./settings-advanced.template.html";
import { SettingsAdvancedController } from "./settings-advanced.controller";

export class SettingsAdvancedDirective implements IDirective {
    restrict = "E";
    scope = true;
    template = html;
    controller = SettingsAdvancedController;
    controllerAs = "ctl";

    static getInstance(): IDirectiveFactory {
        return () => new SettingsAdvancedDirective();
    }
}
