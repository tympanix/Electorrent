import { IAugmentedJQuery, IDirective, IDirectiveFactory, IFilterService, IScope, ITimeoutService, IPromise } from "angular";
import { TimeController } from "./time.controller";

interface TimeScope extends IScope {
    time: number | string | Date;
}

export class TimeDirective implements IDirective {
    restrict = "A";
    scope = {
        time: "=",
    };
    controller = TimeController;

    static getInstance(): IDirectiveFactory {
        const factory = ($timeout: ITimeoutService, $filter: IFilterService) =>
            new TimeDirective($timeout, $filter);
        factory.$inject = ["$timeout", "$filter"];
        return factory;
    }

    constructor(
        private $timeout: ITimeoutService,
        private $filter: IFilterService,
    ) {}

    link(scope: TimeScope, element: IAugmentedJQuery) {
        const DAY = 60 * 60 * 24 * 1000;
        const HOUR = 60 * 60 * 1000;
        const MINUTE = 60 * 1000;
        const filter = this.$filter("date");
        let timer: IPromise<void> | undefined;

        const updateTime = () => {
            element.html(filter(scope.time));
        };

        const nextUpdate = () => {
            const date = new Date(scope.time);
            const diff = Math.abs(Date.now() - date.getTime());

            if (diff > DAY) {
                return undefined;
            }

            if (diff < HOUR) {
                return MINUTE;
            }

            if (diff < 6 * HOUR) {
                return 15 * MINUTE;
            }

            return 30 * MINUTE;
        };

        const startTimer = () => {
            const next = nextUpdate();

            if (!next) {
                return;
            }

            timer = this.$timeout(() => {
                updateTime();
                startTimer();
            }, next);
        };

        updateTime();
        startTimer();

        scope.$on("$destroy", () => {
            if (timer) {
                this.$timeout.cancel(timer);
            }
        });
    }
}
