import { IDirective, IDirectiveFactory } from "angular";
import { torrentApp } from "@renderer/app/app.module"
import html from "./settings-about.template.html";

export class SettingsAboutDirective implements IDirective {
    restrict = "E";
    scope = true;
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new SettingsAboutDirective();
    }
}

torrentApp.directive("settingsAbout", SettingsAboutDirective.getInstance())
