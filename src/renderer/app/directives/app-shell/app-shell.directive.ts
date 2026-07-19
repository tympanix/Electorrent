import { IDirective, IDirectiveFactory } from "angular";
import { torrentApp } from "@renderer/app/app.module"
import { AppShellController } from "./app-shell.controller";
import html from "./app-shell.template.html";

export class AppShellDirective implements IDirective {
    restrict = "E";
    scope = true;
    template = html;
    controller = AppShellController;

    static getInstance(): IDirectiveFactory {
        return () => new AppShellDirective();
    }
}

torrentApp.directive("appShell", AppShellDirective.getInstance())
