import { IDirective, IDirectiveFactory } from "angular";
import { torrentApp } from "@renderer/app/app.module"
import html from "./new-label-modal.template.html";

export class NewLabelModalDirective implements IDirective {
    restrict = "E";
    scope = {
        data: "=",
        approve: "&",
    };
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new NewLabelModalDirective();
    }
}

torrentApp.directive("newLabelModal", NewLabelModalDirective.getInstance())
