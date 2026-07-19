import { IDirective, IDirectiveFactory } from "angular";
import { torrentApp } from "@renderer/app/app.module"
import html from "./torrent-sidebar-section.template.html";

export class TorrentSidebarSectionController {
    items: string[] = [];
    active?: string;
    title = "";
    clearRole = "";
    emptyText = "";
    itemAttribute = "";
    specialItemValue?: string;
    specialItemText?: string;
    onSelect?: (locals: { item?: string }) => void;

    isActive(item: string) {
        return this.active === item;
    }

    itemText(item: string) {
        return item === this.specialItemValue && this.specialItemText ? this.specialItemText : item;
    }

    hasSpecialItem() {
        return !!this.specialItemValue;
    }

    displayEmpty() {
        return this.items.length === 0 && !this.hasSpecialItem();
    }

    select(item: string) {
        this.onSelect?.({ item: this.isActive(item) ? undefined : item });
    }

    clear() {
        this.onSelect?.({ item: undefined });
    }
}

export class TorrentSidebarSectionDirective implements IDirective {
    restrict = "E";
    scope = {
        items: "=",
        active: "=",
        title: "@",
        clearRole: "@",
        emptyText: "@",
        itemAttribute: "@",
        specialItemValue: "@",
        specialItemText: "@",
        onSelect: "&",
    };
    bindToController = true;
    controller = TorrentSidebarSectionController;
    controllerAs = "ctl";
    template = html;

    static getInstance(): IDirectiveFactory {
        return () => new TorrentSidebarSectionDirective();
    }
}

torrentApp.directive("torrentSidebarSection", TorrentSidebarSectionDirective.getInstance())
