import { IAugmentedJQuery, IDirective, IDirectiveFactory, IScope } from "angular";
import { torrentApp } from "@renderer/app/app.module"
import { TorrentBodyController } from "./torrent-table.controller";

interface TorrentRowScope extends IScope {
    render: () => void;
}

export class TorrentBodyDirective implements IDirective {
    restrict = "A";
    controller = TorrentBodyController;
    bindToController = true;
    scope = {
        columns: "=",
    };

    static getInstance(): IDirectiveFactory {
        return () => new TorrentBodyDirective();
    }

    link(scope: IScope, element: IAugmentedJQuery, attr: unknown, controller: TorrentBodyController) {
        controller.renderTemplate();

        scope.$watch(
            () => controller.columns,
            () => {
                controller.render();
            },
            true,
        );
    }
}

export class TorrentRowDirective implements IDirective {
    restrict = "A";
    require = "^^torrentBody";
    scope = false;

    static getInstance(): IDirectiveFactory {
        return () => new TorrentRowDirective();
    }

    link(scope: TorrentRowScope, element: IAugmentedJQuery, attr: unknown, controller: TorrentBodyController) {
        scope.render = () => {
            element.empty();
            controller.$link(scope, (clone) => {
                element.append(clone);
            });
        };

        scope.render();
        controller.subscribe(scope);
    }
}

torrentApp.directive("torrentBody", TorrentBodyDirective.getInstance())
torrentApp.directive("torrentRow", TorrentRowDirective.getInstance())
