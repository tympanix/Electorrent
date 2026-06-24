import { IDirective, IDirectiveFactory } from "angular";
import { LabelsDropdownController } from "./labels-dropdown.controller";
import html from "./labels-dropdown.template.html";

export class LabelsDropdownDirective implements IDirective {
    restrict = "A";
    template = html;
    scope = {
        enabled: "=?",
        action: "=",
        labels: "=",
        labelColorStyle: "=?",
    };
    controller = LabelsDropdownController;

    static getInstance(): IDirectiveFactory {
        return () => new LabelsDropdownDirective();
    }
}
