import { IAttributes, IAugmentedJQuery, IDirective, IDirectiveFactory, IScope } from "angular";
import { SortingController } from "./sorting.controller";

interface SortScope extends IScope {
    sort: string;
    update: () => void;
}

export class SortingDirective implements IDirective {
    restrict = "A";
    bindToController = true;
    scope = {
        mode: "=",
        sorting: "=",
        defaultSortKey: "@?",
        defaultSortOrder: "<?",
        sortKeyPrefix: "@?",
        sortOrderPrefix: "@?",
    };
    controller = SortingController;

    static getInstance(): IDirectiveFactory {
        return () => new SortingDirective();
    }

    link(scope: IScope, element: IAugmentedJQuery, attr: IAttributes, controller: SortingController) {
        const update = () => {
            $(element)
                .find("*[sort]")
                .each((index, column) => {
                    const columnScope = angular.element(column).scope() as SortScope;
                    columnScope.update();
                });
        };

        scope.$watch(
            () => controller.mode,
            (newMode, oldMode) => {
                if (newMode !== oldMode) {
                    controller.updateSettings();
                    update();
                }
            },
        );
    }
}

export class SortDirective implements IDirective {
    restrict = "A";
    require = "^^sorting";
    scope = false;

    static getInstance(): IDirectiveFactory {
        return () => new SortDirective();
    }

    link(scope: SortScope, element: IAugmentedJQuery, attr: IAttributes, controller: SortingController) {
        const column = $(element);
        scope.sort = scope.$eval(attr.sort || "");

        if (attr.sortDisabled && scope.$eval(attr.sortDisabled)) {
            scope.update = () => undefined;
            column.addClass("sorting-disabled");
            return;
        }

        const setSortingArrow = (sortDesc?: boolean) => {
            if (controller.last) {
                controller.last.removeClass("sortdown sortup");
            }

            if (sortDesc === true) {
                column.addClass("sortdown");
            } else if (sortDesc === false) {
                column.addClass("sortup");
            } else {
                column.removeClass("sortdown sortup");
            }

            controller.last = column;
        };

        const showSortingArrows = () => {
            if (column.is(".sortdown, .sortup")) {
                column.toggleClass("sortdown sortup");
            } else {
                if (controller.last) {
                    controller.last.removeClass("sortdown sortup");
                }
                column.addClass("sortdown");
                controller.last = column;
            }

            const desc = column.hasClass("sortdown");
            controller.sorting(scope.sort, desc);
            controller.save(scope.sort, desc);
        };

        let isDragging = false;

        column.mousedown(() => {
            $(window).one("mousemove", () => {
                isDragging = true;
            });
        });

        column.mouseup(() => {
            const wasDragging = isDragging;
            isDragging = false;
            $(window).off("mousemove");
            if (!wasDragging) {
                showSortingArrows();
            }
        });

        scope.update = () => {
            if (scope.sort === controller.sortKey) {
                setSortingArrow(controller.sortOrder);
                controller.sorting(scope.sort, controller.sortOrder);
            }
        };

        column.append('<i class="ui sorting icon"></i>');
        scope.update();
    }
}
