import { IDirective, IDirectiveFactory } from "angular";
import { torrentApp } from "@renderer/app/app.module"
import html from "./settings-servers.template.html";

export class SettingsServersDirective implements IDirective {
    restrict = "E";
    scope = true;
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new SettingsServersDirective();
    }
}

torrentApp.directive("settingsServers", SettingsServersDirective.getInstance())
