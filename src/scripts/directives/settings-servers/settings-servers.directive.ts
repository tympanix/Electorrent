import { IDirective, IDirectiveFactory } from "angular";
import html from "./settings-servers.template.html";

export class SettingsServersDirective implements IDirective {
    restrict = "E";
    scope = true;
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new SettingsServersDirective();
    }
}
