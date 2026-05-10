import { IDirective, IDirectiveFactory, IRootScopeService, ITimeoutService, IScope } from "angular";
import { ReadyBroadcastController } from "./ready-broadcast.controller";

export class ReadyBroadcastDirective implements IDirective {
    restrict = "A";
    controller = ReadyBroadcastController;

    static getInstance(): IDirectiveFactory {
        const factory = ($rootScope: IRootScopeService, $timeout: ITimeoutService) =>
            new ReadyBroadcastDirective($rootScope, $timeout);
        factory.$inject = ["$rootScope", "$timeout"];
        return factory;
    }

    constructor(
        private $rootScope: IRootScopeService,
        private $timeout: ITimeoutService,
    ) {}

    link(scope: IScope) {
        this.$timeout(() => {
            this.$rootScope.$emit("ready");
        });
    }
}
