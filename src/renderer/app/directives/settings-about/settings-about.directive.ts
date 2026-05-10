import { IDirective, IDirectiveFactory } from "angular";
import html from "./settings-about.template.html";

export class SettingsAboutDirective implements IDirective {
    restrict = "E";
    scope = true;
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new SettingsAboutDirective();
    }
}
