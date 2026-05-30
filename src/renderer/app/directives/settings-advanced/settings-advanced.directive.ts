import { IDirective, IDirectiveFactory } from "angular";
import html from "./settings-advanced.template.html";

export class SettingsAdvancedDirective implements IDirective {
    restrict = "E";
    scope = true;
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new SettingsAdvancedDirective();
    }
}
