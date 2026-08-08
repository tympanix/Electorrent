import { CommonModule } from "@angular/common";
import { Component, ElementRef, EventEmitter, HostBinding, HostListener, Input, Output } from "@angular/core";
import type { ActionHandler, ActionHeaderItem } from "./action-header.directive";

export interface ActionHeaderDropdownSelection {
    action: ActionHandler | undefined;
    label: string;
}

@Component({
    selector: "action-header-dropdown, [action-header-dropdown]",
    standalone: true,
    imports: [CommonModule],
    templateUrl: "./action-header-dropdown.template.html",
    host: {
        tabindex: "0",
    },
})
export class ActionHeaderDropdownDirective {
    @Input() actions: ActionHeaderItem[] = [];
    @Input() alwaysActive = false;
    @Input() color?: string;
    @Input() enabled = false;
    @Input() label = "";
    @Input() role?: string;
    @Output() actionSelected = new EventEmitter<ActionHeaderDropdownSelection>();

    open = false;

    constructor(private readonly element: ElementRef<HTMLElement>) {}

    @HostBinding("class")
    get classes(): string {
        return [
            "ui top left pointing labeled icon dropdown button",
            this.color,
            this.enabled && !this.alwaysActive ? "disabled" : "",
            this.open ? "active visible" : "",
        ].filter(Boolean).join(" ");
    }

    @HostBinding("attr.data-role")
    get dataRole(): string | undefined {
        return this.role;
    }

    @HostListener("click", ["$event"])
    toggle(event: MouseEvent): void {
        if (this.enabled && !this.alwaysActive) {
            return;
        }

        event.preventDefault();
        this.open = !this.open;
    }

    select(action: ActionHeaderItem, event: MouseEvent): void {
        event.stopPropagation();
        this.open = false;
        this.actionSelected.emit({ action: action.click, label: action.label });
    }

    @HostListener("document:click", ["$event"])
    closeOnOutsideClick(event: MouseEvent): void {
        if (this.open && !this.element.nativeElement.contains(event.target as Node)) {
            this.open = false;
        }
    }

    @HostListener("window:keyup", ["$event"])
    closeOnEscape(event: KeyboardEvent): void {
        if (event.key !== "Escape" || !this.open) {
            return;
        }

        this.open = false;
        this.element.nativeElement.blur();
    }
}
