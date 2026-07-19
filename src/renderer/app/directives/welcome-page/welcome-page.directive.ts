import { IDirective, IDirectiveFactory } from "angular";
import { torrentApp } from "@renderer/app/app.module"
import { WelcomePageController } from "./welcome-page.controller";
import html from "./welcome-page.template.html";

export class WelcomePageDirective implements IDirective {
    restrict = "E";
    scope = true;
    template = html;
    controller = WelcomePageController;

    static getInstance(): IDirectiveFactory {
        return () => new WelcomePageDirective();
    }
}

torrentApp.directive("welcomePage", WelcomePageDirective.getInstance())
