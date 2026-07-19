import { IDirective, IDirectiveFactory } from "angular";
import { torrentApp } from "@renderer/app/app.module"
import html from "./settings-general.template.html";

export class SettingsGeneralDirective implements IDirective {
    restrict = "E";
    scope = true;
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new SettingsGeneralDirective();
    }
}

torrentApp.directive("settingsGeneral", SettingsGeneralDirective.getInstance())
