import { IAugmentedJQuery, IDirective, IDirectiveFactory, IScope } from "angular";
import html from "./action-header-dropdown.template.html";

type ActionHandler = (...args: never[]) => unknown;

interface ActionHeaderDropdownAction {
    click?: ActionHandler;
    label: string;
}

interface ActionHeaderDropdownScope extends IScope {
    actions: ActionHeaderDropdownAction[];
    alwaysActive?: boolean;
    color?: string;
    enabled?: boolean;
    label: string;
    onAction: (locals: { action: ActionHeaderDropdownAction["click"]; label: string }) => void;
    open: boolean;
    role?: string;
    select: (action: ActionHeaderDropdownAction, event: JQuery.ClickEvent) => void;
    toggle: (event: JQuery.ClickEvent) => void;
}

export class ActionHeaderDropdownDirective implements IDirective {
    restrict = "E";
    replace = true;
    scope = {
        actions: "=",
        alwaysActive: "=?",
        color: "@",
        enabled: "=?",
        label: "@",
        onAction: "&",
        role: "@",
    };
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new ActionHeaderDropdownDirective();
    }

    link(scope: ActionHeaderDropdownScope, element: IAugmentedJQuery) {
        const close = () => {
            scope.open = false;
        };

        scope.toggle = (event) => {
            if (scope.enabled && !scope.alwaysActive) {
                return;
            }

            event.preventDefault();
            scope.open = !scope.open;
        };

        scope.select = (action, event) => {
            event.stopPropagation();
            close();
            scope.onAction({ action: action.click, label: action.label });
        };

        const onBodyClick = (event: MouseEvent) => {
            if (!element[0].contains(event.target as Node) && scope.open) {
                scope.$applyAsync(close);
            }
        };

        const onKeyUp = (event: KeyboardEvent) => {
            if (event.key === "Escape" && scope.open) {
                scope.$applyAsync(close);
                (element[0] as HTMLElement).blur();
            }
        };

        document.body.addEventListener("click", onBodyClick);
        window.addEventListener("keyup", onKeyUp);

        scope.$on("$destroy", () => {
            document.body.removeEventListener("click", onBodyClick);
            window.removeEventListener("keyup", onKeyUp);
        });
    }
}
