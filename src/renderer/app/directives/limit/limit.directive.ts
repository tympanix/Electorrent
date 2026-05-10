import { IAugmentedJQuery, IDirective, IDirectiveFactory, IScope } from "angular";
import { LimitBindController } from "./limit.controller";

export class LimitBindDirective implements IDirective {
    scope = false;
    bindToController = {
        limit: "=limitBind",
    };
    controller = LimitBindController;

    static getInstance(): IDirectiveFactory {
        return () => new LimitBindDirective();
    }

    link(scope: IScope, element: IAugmentedJQuery, attr: unknown, controller: LimitBindController) {
        controller.setContainer(element);

        const onResize = () => {
            scope.$apply(() => {
                controller.updateLimit();
            });
        };

        $(window).on("resize", onResize);
        scope.$on("$destroy", () => {
            $(window).off("resize", onResize);
        });
    }
}

export class LimitSourceDirective implements IDirective {
    scope = false;
    require = "^^limitBind";

    static getInstance(): IDirectiveFactory {
        return () => new LimitSourceDirective();
    }

    link(scope: IScope & { $first?: boolean }, element: IAugmentedJQuery, attr: unknown, controller: LimitBindController) {
        if (scope.$first) {
            controller.updateLimit(element, true);
        }
    }
}
