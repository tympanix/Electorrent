import { IDirective, IDirectiveFactory } from "angular";
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
