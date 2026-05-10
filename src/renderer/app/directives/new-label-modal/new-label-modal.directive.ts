import { IDirective, IDirectiveFactory } from "angular";
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
