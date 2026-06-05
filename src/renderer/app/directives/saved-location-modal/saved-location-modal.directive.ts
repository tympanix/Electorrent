import { IDirective, IDirectiveFactory } from "angular";
import { SavedLocationModalController } from "./saved-location-modal.controller";
import html from "./saved-location-modal.template.html";

export class SavedLocationModalDirective implements IDirective {
    restrict = "E";
    scope = {
        modalId: "@?",
    };
    template = html;
    controller = SavedLocationModalController;
    controllerAs = "ctl";

    static getInstance(): IDirectiveFactory {
        return () => new SavedLocationModalDirective();
    }
}
