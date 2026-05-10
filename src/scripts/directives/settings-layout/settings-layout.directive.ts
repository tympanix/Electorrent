import { IDirective, IDirectiveFactory } from "angular";
import html from "./settings-layout.template.html";

export class SettingsLayoutDirective implements IDirective {
    restrict = "E";
    scope = true;
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new SettingsLayoutDirective();
    }
}
