import { IDirective, IDirectiveFactory } from "angular";
import { torrentApp } from "@renderer/app/app.module"
import html from "./certificate-modal.template.html";

export class CertificateModalDirective implements IDirective {
    restrict = "E";
    scope = {
        data: "=",
        approve: "&",
        allowInsecureTls: "&",
        after: "=",
        modalRef: "=",
    };
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new CertificateModalDirective();
    }
}

torrentApp.directive("certificateModal", CertificateModalDirective.getInstance())
