import { IDirective, IDirectiveFactory, IScope } from "angular";
import { ActionHeaderController } from "./action-header.controller";
import html from "./action-header.template.html";

type ActionHandler = (...args: never[]) => unknown;

interface ActionHeaderItem {
    actions?: ActionHeaderItem[];
    alwaysActive?: boolean;
    color?: string;
    click?: ActionHandler;
    icon?: string;
    label: string;
    labelAction?: (label: string, create?: boolean) => void;
    role?: string;
    type?: string;
}

interface ActionHeaderScope extends IScope {
    actions: ActionHeaderItem[];
    actionItems: ActionHeaderItem[];
    click: (action: ActionHandler | undefined, ...args: unknown[]) => void;
    labels: string[];
    bind?: Record<string, never>;
    enabled?: boolean;
    invoke: (action: ActionHeaderItem["click"], label: string) => void;
}

export class ActionHeaderDirective implements IDirective {
    restrict = "A";
    template = html;
    scope = {
        actions: "=",
        click: "=",
        labels: "=",
        bind: "=?",
        enabled: "=?",
    };
    controller = ActionHeaderController;

    static getInstance(): IDirectiveFactory {
        return () => new ActionHeaderDirective();
    }

    link(scope: ActionHeaderScope) {
        scope.bind = {};
        scope.invoke = (action, label) => scope.click(action, label);

        scope.$watchCollection("actions", (actions: ActionHeaderItem[] = []) => {
            scope.actionItems = actions.map((item) => ({
                ...item,
                labelAction: item.type === "labels"
                    ? (label: string, create?: boolean) => {
                        scope.click(item.click, `${item.label} ${label}`, label, create);
                    }
                    : undefined,
            }));
        });
    }
}
