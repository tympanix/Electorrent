import { IDirective, IDirectiveFactory } from "angular";
import html from "./settings-general.template.html";

export class SettingsGeneralDirective implements IDirective {
    restrict = "E";
    scope = true;
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new SettingsGeneralDirective();
    }
}
