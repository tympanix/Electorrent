import { IDirective, IDirectiveFactory } from "angular";
import { torrentApp } from "@renderer/app/app.module"
import html from "./update-modal.template.html";

export class UpdateModalDirective implements IDirective {
    restrict = "E";
    scope = {
        data: "=",
        approve: "&",
        modalRef: "=",
    };
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new UpdateModalDirective();
    }
}

torrentApp.directive("updateModal", UpdateModalDirective.getInstance())
