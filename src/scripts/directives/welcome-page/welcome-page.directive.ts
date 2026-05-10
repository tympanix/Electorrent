import { IDirective, IDirectiveFactory } from "angular";
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
