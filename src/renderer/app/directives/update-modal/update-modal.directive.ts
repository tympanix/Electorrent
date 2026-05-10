import { IDirective, IDirectiveFactory } from "angular";
import html from "./update-modal.template.html";

export class UpdateModalDirective implements IDirective {
    restrict = "E";
    scope = {
        data: "=",
        approve: "&",
    };
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new UpdateModalDirective();
    }
}
