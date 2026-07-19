import { IDirective, IDirectiveFactory } from "angular";
import { torrentApp } from "@renderer/app/app.module"
import html from "./labels-menu.template.html";

export class LabelsMenuDirective implements IDirective {
    restrict = "E";
    scope = true;
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new LabelsMenuDirective();
    }
}

torrentApp.directive("labelsMenu", LabelsMenuDirective.getInstance())
