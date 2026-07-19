import { IDirective, IDirectiveFactory } from "angular";
import { torrentApp } from "@renderer/app/app.module"
import { SettingsPageController } from "./settings-page.controller";
import html from "./settings-page.template.html";

export class SettingsPageDirective implements IDirective {
    restrict = "E";
    scope = true;
    template = html;
    controller = SettingsPageController;

    static getInstance(): IDirectiveFactory {
        return () => new SettingsPageDirective();
    }
}

torrentApp.directive("settingsPage", SettingsPageDirective.getInstance())
