import { IDirective, IDirectiveFactory } from "angular";
import html from "./labels-menu.template.html";

export class LabelsMenuDirective implements IDirective {
    restrict = "E";
    scope = true;
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new LabelsMenuDirective();
    }
}
