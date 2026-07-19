import { IDirective, IDirectiveFactory } from "angular";
import { torrentApp } from "@renderer/app/app.module"
import html from "./rename-server-modal.template.html";

export class RenameServerModalDirective implements IDirective {
    restrict = "E";
    scope = {
        data: "=",
        approve: "&",
    };
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new RenameServerModalDirective();
    }
}

torrentApp.directive("renameServerModal", RenameServerModalDirective.getInstance())
