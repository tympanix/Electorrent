import { IAttributes, IAugmentedJQuery, ICompileService, IControllerProvider, IControllerService, IDirective, IDirectiveCompileFn, IDirectiveFactory, IDirectiveLinkFn, IDirectivePrePost, IRootElementService, IRootScopeService, IScope } from "angular";
import { link } from "fs";
import { TorrentUploadFormController } from "./torrent-upload-form.controller";
import html from "./torrent-upload-form.template.html"

export interface TorrentUploadFormScope extends IScope {
    torrents: {data: Uint8Array, filename: string}[]
}

export abstract class Directive implements IDirective {

    static $inject: string[]

    compile?: IDirectiveCompileFn;
    controller?: any;
    controllerAs?: string;
    multiElement?: boolean;
    name?: string;
    priority?: number;
    require?: string | string[] | {[controller: string]: string};
    restrict?: string;
    scope?: boolean | Object;
    template?: string | Function;
    templateNamespace?: string;
    templateUrl?: string | Function;
    terminal?: boolean;
    transclude?: boolean | string | {[slot: string]: string};

    link?(scope?: IScope, element?: IAugmentedJQuery, attrs?: IAttributes, controller?: any): void
}

export class TorrentUploadFormDirective extends Directive {

    constructor() {
        super()
        this.template = html
        this.restrict = "E"
        this.scope = {
            options: "=",
            loading: "<",
        }
        this.controller = TorrentUploadFormController
        this.controllerAs = "ctl"
    }

    static getInstance() {
        return () => new TorrentUploadFormDirective()
    }

}