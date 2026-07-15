import { IDirective, IDirectiveFactory } from "angular";
import { LabelColorModalController } from "./label-color-modal.controller";
import html from "./label-color-modal.template.html";

export class LabelColorModalDirective implements IDirective {
    restrict = "E";
    scope = {
        modalId: "@?",
    };
    template = html;
    controller = LabelColorModalController;
    controllerAs = "ctl";

    static getInstance(): IDirectiveFactory {
        return () => new LabelColorModalDirective();
    }
}
