import { IDirective, IDirectiveFactory } from "angular";
import { ModalController } from "@renderer/app/directives/modal/modal.controller";
import html from "./rename-server-modal.template.html";

interface RenameServerModalScope extends angular.IScope {
    data: {
        server?: any;
        name: string;
    };
    modalRef?: RenameServerModalController;
}

class RenameServerModalController {
    static $inject = ["$scope"];

    modalref?: ModalController;

    constructor(private readonly scope: RenameServerModalScope) {
        this.scope.modalRef = this;
    }

    open(server: any) {
        this.scope.data.server = server;
        this.scope.data.name = server.getDisplayName();
        this.modalref?.showModal();
    }
}

export class RenameServerModalDirective implements IDirective {
    restrict = "E";
    scope = {
        data: "=",
        approve: "&",
        modalRef: "=?",
    };
    template = html;
    controller = RenameServerModalController;
    controllerAs = "ctl";

    static getInstance(): IDirectiveFactory {
        return () => new RenameServerModalDirective();
    }
}
