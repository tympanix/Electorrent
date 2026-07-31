import { IDirective, IDirectiveFactory } from "angular";
import { SettingsServersController } from "./settings-servers.controller";
import html from "./settings-servers.template.html";

export class SettingsServersDirective implements IDirective {
    restrict = "E";
    scope = {};
    bindToController = {
        settings: "<",
        renameData: "<",
        onToggleDefaultServer: "&",
        onMoveServerUp: "&",
        onDisableInsecureTls: "&",
        onRemoveServer: "&",
        onRenameServer: "&",
    };
    controller = SettingsServersController;
    controllerAs = "ctl";
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new SettingsServersDirective();
    }
}
