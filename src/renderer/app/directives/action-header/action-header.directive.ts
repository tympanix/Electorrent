import { CommonModule } from "@angular/common";
import { Component, Input, OnChanges } from "@angular/core";
import { LabelsDropdownDirective } from "../labels-dropdown/labels-dropdown.directive";
import { ActionHeaderDropdownDirective } from "./action-header-dropdown.directive";

export type ActionHandler = (...args: never[]) => unknown;

export interface ActionHeaderItem {
    actions?: ActionHeaderItem[];
    alwaysActive?: boolean;
    color?: string;
    click?: ActionHandler;
    icon?: string;
    label: string;
    labelAction?: (label: string, create?: boolean) => void;
    role?: string;
    type?: "button" | "dropdown" | "labels";
}

export type ActionHeaderClick = (
    action: ActionHandler | undefined,
    label: string,
    data?: unknown,
    ...args: unknown[]
) => unknown;

@Component({
    selector: "[action-header]",
    standalone: true,
    imports: [CommonModule, ActionHeaderDropdownDirective, LabelsDropdownDirective],
    templateUrl: "./action-header.template.html",
})
export class ActionHeaderDirective implements OnChanges {
    @Input() actions: ActionHeaderItem[] = [];
    @Input() labels: string[] = [];
    @Input() enabled = false;
    @Input() click: ActionHeaderClick = () => undefined;
    @Input() bind: Record<string, never> = {};

    actionItems: ActionHeaderItem[] = [];

    ngOnChanges(): void {
        this.actionItems = this.actions.map((item) => ({
            ...item,
            labelAction: item.type === "labels"
                ? (label: string, create?: boolean) => {
                    this.click(item.click, `${item.label} ${label}`, label, create);
                }
                : undefined,
        }));
    }

    invoke(action: ActionHandler | undefined, label: string): void {
        this.click(action, label);
    }
}
