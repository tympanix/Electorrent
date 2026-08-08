import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { LabelChipDirective } from "@renderer/app/directives/label-chip/label-chip.directive";

@Component({
    selector: "torrent-sidebar-section",
    standalone: true,
    imports: [CommonModule, LabelChipDirective],
    templateUrl: "./torrent-sidebar-section.template.html",
})
export class TorrentSidebarSectionDirective {
    @Input() items: string[] = [];
    @Input() active?: string;
    @Input() title = "";
    @Input() clearRole = "";
    @Input() emptyText = "";
    @Input() itemAttribute = "";
    @Input() specialItemValue?: string;
    @Input() specialItemText?: string;
    @Output() readonly onSelect = new EventEmitter<string | undefined>();

    isActive(item: string): boolean {
        return this.active === item;
    }

    itemText(item: string): string {
        return item === this.specialItemValue && this.specialItemText ? this.specialItemText : item;
    }

    hasSpecialItem(): boolean {
        return !!this.specialItemValue;
    }

    displayEmpty(): boolean {
        return this.items.length === 0 && !this.hasSpecialItem();
    }

    select(item: string): void {
        this.onSelect.emit(this.isActive(item) ? undefined : item);
    }

    clear(): void {
        this.onSelect.emit(undefined);
    }

    trackItem(_index: number, item: string): string {
        return item;
    }
}

export {
    TorrentSidebarSectionDirective as TorrentSidebarSectionComponent,
    TorrentSidebarSectionDirective as TorrentSidebarSectionController,
};
