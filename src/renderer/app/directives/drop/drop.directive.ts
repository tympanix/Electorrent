import { IAttributes, IAugmentedJQuery, IDirective, IDirectiveFactory, IScope } from "angular";
import { DropDownController } from "./drop.controller";
import html from "./drop.template.html";
import dropdownGroupHtml from "./dropdown-group.template.html";

interface DropdownScope extends IScope {
    title: string;
    open?: string;
    openOnFocus?: string;
    model: any;
    change?: () => void;
    disabled?: boolean;
    dropdown_class: string;
    menu_class: string;
    text_class: string;
    original_title: string;
    is_open: boolean;
}

interface DropdownGroupScope extends IScope {
    title?: string;
    value?: any;
    item_title: string;
    item_value: any;
    active: () => string | void;
}

export class DropdownElementDirective implements IDirective {
    restrict = "E";
    replace = true;
    transclude = true;
    controller = DropDownController;
    scope = {
        title: "@",
        open: "@",
        openOnFocus: "@?",
        model: "=ngModel",
        change: "&?ngChange",
        disabled: "=?ngDisabled",
    };
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new DropdownElementDirective();
    }

    link(scope: DropdownScope, element: IAugmentedJQuery, attrs: IAttributes, controller: DropDownController) {
        let isMouseDown = false;
        const originalTitle = attrs.title || scope.title;
        const openOnFocus = scope.openOnFocus !== "false";

        scope.dropdown_class = "ui selection dropdown";
        scope.menu_class = "menu transition hidden";
        scope.title = originalTitle;
        scope.text_class = "default text";
        scope.original_title = originalTitle;
        scope.is_open = scope.open === "true";

        if (scope.is_open) {
            scope.dropdown_class = `${scope.dropdown_class} active visible`;
            scope.menu_class = `${scope.menu_class} visible`;
        }

        const dropdownClass = (state = "") => {
            return ["ui selection dropdown", state, scope.disabled ? "disabled" : ""].filter(Boolean).join(" ");
        };

        const close = () => {
            scope.is_open = false;
            scope.$apply(() => {
                scope.dropdown_class = dropdownClass();
                scope.menu_class = "menu transition hidden";
            });
        };

        const open = () => {
            if (scope.disabled) {
                return;
            }
            scope.is_open = true;
            scope.$apply(() => {
                scope.dropdown_class = dropdownClass("active visible");
                scope.menu_class = "menu transition visible";
            });
        };

        const toggle = () => {
            if (scope.disabled) {
                return;
            }
            if (scope.is_open) {
                close();
            } else {
                open();
            }
        };

        const onFocus = () => {
            if (openOnFocus && !scope.is_open && !isMouseDown) {
                open();
            }
        };

        const onMouseDown = () => {
            isMouseDown = true;
        };

        const onMouseUp = () => {
            isMouseDown = false;
        };

        const onBodyClick = (event: MouseEvent) => {
            if (!element[0].contains(event.target as Node) && scope.is_open) {
                close();
            }
        };

        const onKeyUp = (event: KeyboardEvent) => {
            if (event.key === "Escape" && scope.is_open) {
                close();
                (element[0] as HTMLElement).blur();
            }

            if (event.key === "Enter" && scope.is_open) {
                close();
            }
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.code === "Space") {
                event.preventDefault();
                toggle();
                return;
            }

            if (!scope.is_open) {
                return;
            }

            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(event.code) > -1) {
                event.preventDefault();
            }

            switch (event.code) {
            case "ArrowUp":
                controller.previous();
                break;
            case "ArrowDown":
                controller.next();
                break;
            default:
                break;
            }
        };

        const onBlur = () => {
            if (scope.is_open) {
                close();
            }
        };

        scope.$watch("model", (value) => {
            controller.update_title(value);
            if (scope.change) {
                scope.change();
            }
        });
        scope.$watch("disabled", () => {
            if (scope.disabled && scope.is_open) {
                close();
            } else {
                scope.dropdown_class = dropdownClass(scope.is_open ? "active visible" : "");
            }
        });
        scope.$evalAsync(() => {
            controller.update_title(scope.model);
        });

        element.on("click", toggle);
        element.on("focus", onFocus);
        element.on("mousedown", onMouseDown);
        element.on("blur", onBlur);
        element[0].addEventListener("keydown", onKeyDown);
        document.body.addEventListener("click", onBodyClick);
        window.addEventListener("keyup", onKeyUp);
        window.addEventListener("mouseup", onMouseUp);

        scope.$on("$destroy", () => {
            element.off("click", toggle);
            element.off("focus", onFocus);
            element.off("mousedown", onMouseDown);
            element.off("blur", onBlur);
            element[0].removeEventListener("keydown", onKeyDown);
            document.body.removeEventListener("click", onBodyClick);
            window.removeEventListener("keyup", onKeyUp);
            window.removeEventListener("mouseup", onMouseUp);
        });
    }
}

export class DropdownGroupDirective implements IDirective {
    restrict = "AE";
    replace = true;
    transclude = true;
    require = "^dropdown";
    scope = {
        title: "=title",
        value: "=value",
    };
    template = dropdownGroupHtml;

    static getInstance(): IDirectiveFactory {
        return () => new DropdownGroupDirective();
    }

    link(scope: DropdownGroupScope, element: IAugmentedJQuery, attrs: IAttributes, controller: DropDownController) {
        if (scope.title === undefined) {
            scope.item_title = attrs.title || element[0]?.innerHTML || "";
        } else {
            scope.item_title = scope.title;
        }

        if (scope.value === undefined) {
            scope.item_value = attrs.value || scope.item_title;
        } else {
            scope.item_value = scope.value;
        }

        scope.active = () => {
            if (controller.active(scope.item_value)) {
                return "selected active";
            }
        };

        controller.add_option(scope.item_title, scope.item_value);

        const onClick = () => {
            controller.update_model(scope.item_title, scope.item_value);
        };

        element.on("click", onClick);

        scope.$on("$destroy", () => {
            element.off("click", onClick);
            controller.remove_option(scope.item_title, scope.item_value);
        });
    }
}
