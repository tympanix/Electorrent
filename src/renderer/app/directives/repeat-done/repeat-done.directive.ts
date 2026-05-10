import { IAttributes, IAugmentedJQuery, IDirective, IDirectiveFactory, IScope, ITimeoutService } from "angular";
import { RepeatDoneController } from "./repeat-done.controller";

export class RepeatDoneDirective implements IDirective {
    restrict = "A";
    controller = RepeatDoneController;

    static getInstance(): IDirectiveFactory {
        const factory = ($timeout: ITimeoutService) => new RepeatDoneDirective($timeout);
        factory.$inject = ["$timeout"];
        return factory;
    }

    constructor(private $timeout: ITimeoutService) {}

    link(scope: IScope, element: IAugmentedJQuery, attrs: IAttributes) {
        if ((scope as IScope & { $last?: boolean }).$last) {
            this.$timeout(() => {
                const callback = scope.$eval(attrs.repeatDone);
                if (angular.isFunction(callback)) {
                    callback();
                }
            }, 0);
        }
    }
}
