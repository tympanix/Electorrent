import { IDirective, IDirectiveFactory } from "angular";
import html from "./settings-connection.template.html";

export class SettingsConnectionDirective implements IDirective {
    restrict = "E";
    scope = true;
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new SettingsConnectionDirective();
    }
}
