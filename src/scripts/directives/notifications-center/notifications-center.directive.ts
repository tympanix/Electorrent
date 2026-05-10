import { IDirective, IDirectiveFactory } from "angular";
import { NotificationsCenterController } from "./notifications-center.controller";
import html from "./notifications-center.template.html";

export class NotificationsCenterDirective implements IDirective {
    restrict = "E";
    scope = true;
    template = html;
    controller = NotificationsCenterController;

    static getInstance(): IDirectiveFactory {
        return () => new NotificationsCenterDirective();
    }
}
