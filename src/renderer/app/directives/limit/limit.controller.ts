import { IAugmentedJQuery } from "angular";

export class LimitBindController {
    limit!: number;
    private container?: IAugmentedJQuery;
    private elementHeight?: number;

    updateLimit(element?: IAugmentedJQuery, force?: boolean) {
        if (element) {
            this.elementHeight = element.outerHeight() || 0;
        }

        if (!this.container || !this.elementHeight) {
            return;
        }

        const limit = Math.ceil((this.container.innerHeight() || 0) / this.elementHeight);
        if (limit > this.limit || force) {
            this.limit = limit;
        }
    }

    setContainer(element: IAugmentedJQuery) {
        this.container = element;
    }
}
