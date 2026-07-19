import { IDirective, IDirectiveFactory } from "angular";
import { torrentApp } from "@renderer/app/app.module"
import html from "./settings-layout.template.html";

export class SettingsLayoutDirective implements IDirective {
    restrict = "E";
    scope = true;
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new SettingsLayoutDirective();
    }
}

torrentApp.directive("settingsLayout", SettingsLayoutDirective.getInstance())
