import { IDirective, IDirectiveFactory } from "angular";
import { torrentApp } from "@renderer/app/app.module"
import { TitleBarMenuController } from "./title-bar-menu.controller";
import html from "./title-bar-menu.template.html";

export class TitleBarMenuDirective implements IDirective {
    restrict = "E";
    scope = {
        currentPage: "&",
    };
    template = html;
    controller = TitleBarMenuController;

    static getInstance(): IDirectiveFactory {
        return () => new TitleBarMenuDirective();
    }
}

torrentApp.directive("titleBarMenu", TitleBarMenuDirective.getInstance())
