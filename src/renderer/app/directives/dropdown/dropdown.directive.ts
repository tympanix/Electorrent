import { IAttributes, IAugmentedJQuery, IDirective, IDirectiveFactory, IScope } from "angular";

export class DropdownController {
    model?: any;
    disabled?: boolean;
    title?: string;
    openOnFocus?: string;
    dropdownNoBlur?: string;
    onChange?: () => void;

    private dropdown?: any;
    private scope?: IScope;
    private values = new Map<string, any>();

    initialize(scope: IScope, element: IAugmentedJQuery, hasModel: boolean) {
        this.scope = scope;
        this.dropdown = $(element);

        this.dropdown.dropdown({
            transition: "vertical flip",
            duration: 100,
            action: hasModel ? "activate" : "hide",
            showOnFocus: this.openOnFocus !== "false",
            onChange: (value: string) => {
                const modelValue = this.values.has(value) ? this.values.get(value) : value;

                if (!hasModel || this.model === modelValue) {
                    return;
                }

                scope.$evalAsync(() => {
                    this.model = modelValue;
                    this.onChange?.();
                });
            },
        });

        if (this.dropdownNoBlur !== undefined) {
            this.dropdown.off("blur.dropdown");
        }

        this.render();
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
            this.render();
        });
    }

    render() {
        this.dropdown?.dropdown("set selected", this.model);
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
    scope = {};
    bindToController = {
        model: "=?ngModel",
        disabled: "<?ngDisabled",
        onChange: "&?ngChange",
        title: "@?",
        openOnFocus: "@?",
        dropdownNoBlur: "@?",
    };
    controller = DropdownController;
    controllerAs = "ctl";
    require = "dropdown";
    transclude = true;
    template = "";

    static getInstance(): IDirectiveFactory {
        return () => new DropdownDirective();
    }

    link(
        scope: IScope,
        element: IAugmentedJQuery,
        attrs: IAttributes,
        controller: DropdownController,
        transclude: any,
    ) {
        transclude((contents: IAugmentedJQuery) => element.append(contents));

        if (!element.children(".menu").length) {
            const items = element.contents().detach();
            const text = angular.element('<div class="default text"></div>');
            const menu = angular.element('<div class="menu"></div>');

            text.text(controller.title || "");
            menu.append(items);
            element.append(text, angular.element('<i class="dropdown icon"></i>'), menu);
            element.addClass("selection");
        }

        element.addClass("ui dropdown");
        controller.initialize(scope, element, Boolean(attrs.ngModel));

        const unwatchModel = scope.$watch(() => controller.model, () => controller.render());
        const unwatchDisabled = scope.$watch(
            () => controller.disabled,
            (disabled) => controller.setDisabled(Boolean(disabled)),
        );

        scope.$on("$destroy", () => {
            unwatchModel();
            unwatchDisabled();
            controller.destroy();
        });
    }
}

export class DropdownItemController {
    value?: any;
    title?: any;
    dataValue?: string;
}

export class DropdownItemDirective implements IDirective {
    restrict = "E";
    scope = {};
    bindToController = {
        value: "<?",
        title: "<?",
        dataValue: "@?",
    };
    controller = DropdownItemController;
    controllerAs = "ctl";
    replace = true;
    transclude = true;
    require = ["dropdownItem", "^dropdown"];
    template = '<div class="item" ng-transclude></div>';

    static getInstance(): IDirectiveFactory {
        return () => new DropdownItemDirective();
    }

    link(
        scope: IScope,
        element: IAugmentedJQuery,
        attrs: IAttributes,
        controllers: [DropdownItemController, DropdownController],
    ) {
        const [item, dropdown] = controllers;
        const value = item.value ?? item.dataValue ?? attrs.value;
        const title = item.title ?? attrs.title;

        if (value !== undefined) {
            element.attr("data-value", String(value));
        }
        if (!element.text().trim() && title !== undefined) {
            element.text(String(title));
        }

        dropdown.addItem(value);
        scope.$on("$destroy", () => dropdown.removeItem(value));
    }
}
