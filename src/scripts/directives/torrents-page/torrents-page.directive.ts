import { IDirective, IDirectiveFactory } from "angular";
import { TorrentsPageController } from "./torrents-page.controller";
import html from "./torrents-page.template.html";

export class TorrentsPageDirective implements IDirective {
    restrict = "E";
    scope = true;
    template = html;
    controller = TorrentsPageController;

    static getInstance(): IDirectiveFactory {
        return () => new TorrentsPageDirective();
    }
}
