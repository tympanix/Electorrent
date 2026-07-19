import { IDirective, IDirectiveFactory } from "angular";
import { torrentApp } from "@renderer/app/app.module"
import html from "./server-selection.template.html";

export class ServerSelectionDirective implements IDirective {
    restrict = "E";
    scope = {
        servers: "=",
        connectToServer: "&",
    };
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new ServerSelectionDirective();
    }
}

torrentApp.directive("serverSelection", ServerSelectionDirective.getInstance())
