import { IDirective, IDirectiveFactory } from "angular";
import html from "./certificate-modal.template.html";

export class CertificateModalDirective implements IDirective {
    restrict = "E";
    scope = {
        data: "=",
        approve: "&",
        after: "=",
    };
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new CertificateModalDirective();
    }
}
