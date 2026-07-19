import { IDirective, IDirectiveFactory } from "angular";
import { torrentApp } from "@renderer/app/app.module"
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

torrentApp.directive("insecureTlsModal", InsecureTlsModalDirective.getInstance())
