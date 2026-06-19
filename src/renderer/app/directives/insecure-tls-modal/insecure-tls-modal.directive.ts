import { IDirective, IDirectiveFactory } from "angular";
import html from "./insecure-tls-modal.template.html";

export class InsecureTlsModalDirective implements IDirective {
    restrict = "E";
    scope = {
        data: "=",
        approve: "&",
        after: "=",
        modalRef: "=",
    };
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new InsecureTlsModalDirective();
    }
}
