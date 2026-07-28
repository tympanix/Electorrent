import { IAttributes, IAugmentedJQuery, IDirective, IDirectiveFactory, INgModelController, IScope } from "angular";

export class DropdownController {
    private dropdown?: any;
    private scope?: IScope;
    private ngModel?: INgModelController;
    private values = new Map<string, any>();

    initialize(scope: IScope, element: IAugmentedJQuery, attrs: IAttributes, ngModel?: INgModelController) {
        this.scope = scope;
        this.ngModel = ngModel;
        this.dropdown = $(element);

        this.dropdown.dropdown({
            transition: "vertical flip",
            duration: 100,
            action: ngModel ? "activate" : "hide",
            onChange: (value: string) => {
                const modelValue = this.values.has(value) ? this.values.get(value) : value;

                if (!this.ngModel || this.ngModel.$viewValue === modelValue) {
                    return;
                }

                scope.$evalAsync(() => this.ngModel?.$setViewValue(modelValue));
            },
        });

        if ("dropdownNoBlur" in attrs) {
            this.dropdown.off("blur.dropdown");
        }

        if (ngModel) {
            ngModel.$render = () => {
                this.dropdown?.dropdown("set selected", ngModel.$viewValue);
            };
            ngModel.$render();
        }
    }

    addItem(value?: any) {
        if (value !== undefined) {
            this.values.set(String(value), value);
        }
        this.refresh();
    }

    removeItem(value?: any) {
        if (value !== undefined) {
            this.values.delete(String(value));
        }
        this.refresh();
    }

    private refresh() {
        this.scope?.$evalAsync(() => {
            this.dropdown?.dropdown("refresh");
            this.ngModel?.$render();
        });
    }

    setDisabled(disabled: boolean) {
        this.dropdown?.toggleClass("disabled", disabled);
    }

    destroy() {
        this.dropdown?.dropdown("destroy");
        this.dropdown = undefined;
        this.values.clear();
    }
}

export class DropdownDirective implements IDirective {
    restrict = "E";
    controller = DropdownController;
    require = ["dropdown", "?ngModel"];

    static getInstance(): IDirectiveFactory {
        return () => new DropdownDirective();
    }

    link(
        scope: IScope,
        element: IAugmentedJQuery,
        attrs: IAttributes,
        controllers: [DropdownController, INgModelController | undefined],
    ) {
        const [controller, ngModel] = controllers;

        if (!element.children(".menu").length) {
            const items = element.contents().detach();
            const text = angular.element('<div class="default text"></div>');
            const menu = angular.element('<div class="menu"></div>');

            text.text(attrs.title || "");
            menu.append(items);
            element.append(text, angular.element('<i class="dropdown icon"></i>'), menu);
            element.addClass("selection");
        }

        element.addClass("ui dropdown");
        controller.initialize(scope, element, attrs, ngModel);

        const unwatchDisabled = attrs.ngDisabled
            ? scope.$watch(attrs.ngDisabled, (disabled) => controller.setDisabled(Boolean(disabled)))
            : undefined;

        scope.$on("$destroy", () => {
            unwatchDisabled?.();
            controller.destroy();
        });
    }
}

export class DropdownItemDirective implements IDirective {
    restrict = "E";
    replace = true;
    transclude = true;
    require = "^dropdown";
    template = '<div class="item" ng-transclude></div>';

    static getInstance(): IDirectiveFactory {
        return () => new DropdownItemDirective();
    }

    link(scope: IScope, element: IAugmentedJQuery, attrs: IAttributes, controller: DropdownController) {
        const evaluate = (expression?: string) => {
            if (!expression) {
                return undefined;
            }

            const value = scope.$eval(expression);
            return value === undefined ? expression : value;
        };
        const value = evaluate(attrs.value) ?? attrs.dataValue;
        const title = evaluate(attrs.title);

        if (value !== undefined) {
            element.attr("data-value", String(value));
        }
        if (!element.text().trim() && title !== undefined) {
            element.text(String(title));
        }

        controller.addItem(value);
        scope.$on("$destroy", () => controller.removeItem(value));
    }
}
