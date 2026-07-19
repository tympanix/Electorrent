import { IDirective, IDirectiveFactory } from "angular";
import { torrentApp } from "@renderer/app/app.module"
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

torrentApp.directive("savedLocationModal", SavedLocationModalDirective.getInstance())
