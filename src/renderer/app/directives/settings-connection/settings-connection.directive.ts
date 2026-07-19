import { IDirective, IDirectiveFactory } from "angular";
import { torrentApp } from "@renderer/app/app.module"
import html from "./settings-connection.template.html";

export class SettingsConnectionDirective implements IDirective {
    restrict = "E";
    scope = true;
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new SettingsConnectionDirective();
    }
}

torrentApp.directive("settingsConnection", SettingsConnectionDirective.getInstance())
