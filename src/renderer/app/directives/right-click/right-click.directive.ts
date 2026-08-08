import { Directive, EventEmitter, HostListener, Output } from "@angular/core";

@Directive({
    selector: "[ngRightClick]",
    standalone: true,
})
export class RightClickDirective {
    @Output() ngRightClick = new EventEmitter<MouseEvent>();

    @HostListener("contextmenu", ["$event"])
    handleContextMenu(event: MouseEvent): void {
        event.preventDefault();
        this.ngRightClick.emit(event);
    }
}
