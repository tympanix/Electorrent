import { IAugmentedJQuery, IDirective, IDirectiveFactory, IScope, ITimeoutService } from "angular";
import { ProgressController } from "./progress.controller";
import html from "./progress.template.html";

export class ProgressDirective implements IDirective {
    restrict = "A";
    replace = true;
    template = html;
    scope = {
        torrent: "=progress",
    };
    bindToController = true;
    controller = ProgressController;
    controllerAs = "ctl";

    static getInstance(): IDirectiveFactory {
        const factory = ($timeout: ITimeoutService) => new ProgressDirective($timeout);
        factory.$inject = ["$timeout"];
        return factory;
    }

    constructor(private $timeout: ITimeoutService) {}

    link(scope: IScope, element: IAugmentedJQuery, attr: unknown, controller: ProgressController) {
        let idle = true;
        const bar = element.find(".bar");

        const updateProgress = (oldPercent?: number) => {
            if (!controller.torrent) {
                return;
            }

            if (controller.torrent.percent < 1000 || (oldPercent !== undefined && oldPercent < 1000)) {
                bar.css("width", controller.torrent.getPercentStr());
                if (idle) {
                    this.$timeout(() => {
                        bar.removeClass("idle");
                        idle = false;
                    });
                }
            }
        };

        scope.$watch(
            () => controller.torrent && controller.torrent.percent,
            (newPercent, oldPercent) => {
                if (newPercent !== oldPercent) {
                    updateProgress(oldPercent);
                }
            },
        );

        updateProgress();
    }
}
