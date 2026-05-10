import { IAttributes, IAugmentedJQuery, IDirective, IDirectiveFactory, IScope } from "angular";
import { DropdownController } from "./dropdown.controller";

interface DropdownScope extends IScope {
    ref?: {
        clear: (param?: string) => void;
        refresh: (param?: string) => void;
        setSelected: (param?: string) => void;
        getValue: (param?: string) => void;
    };
    bind?: string;
}

export class SemanticDropdownDirective implements IDirective {
    restrict = "A";
    scope = {
        ref: "=?",
        bind: "=?",
    };
    controller = DropdownController;

    static getInstance(): IDirectiveFactory {
        return () => new SemanticDropdownDirective();
    }

    link(scope: DropdownScope, element: IAugmentedJQuery, attr: IAttributes) {
        const dropdown: any = $(element);

        const doAction = (action: string) => (param?: string) => {
            dropdown.dropdown(action, param);
        };

        dropdown.dropdown({
            transition: "vertical flip",
            duration: 100,
            onChange: (value: string) => {
                if (scope.bind) {
                    scope.bind = value;
                }
            },
            action: "hide",
        });

        if ("ref" in attr) {
            scope.ref = {
                clear: doAction("clear"),
                refresh: doAction("refresh"),
                setSelected: doAction("set selected"),
                getValue: doAction("get value"),
            };
        }

        scope.$watch(
            () => scope.bind,
            (newValue) => {
                if (newValue) {
                    dropdown.dropdown("set selected", newValue);
                }
            },
        );
    }
}

export class DropItemDirective implements IDirective {
    restrict = "A";

    static getInstance(): IDirectiveFactory {
        return () => new DropItemDirective();
    }

    link(scope: IScope & { bind?: string; $last?: boolean }, element: IAugmentedJQuery, attr: IAttributes) {
        if (scope.bind === attr.value) {
            const dropdown: any = $(element).closest(".dropdown");
            dropdown.dropdown("set selected", attr.value);
        }

        if (scope.$last) {
            scope.$emit("update:dropdown");
        }
    }
}
