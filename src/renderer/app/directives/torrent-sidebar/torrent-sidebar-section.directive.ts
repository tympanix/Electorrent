import { IDirective, IDirectiveFactory } from "angular";
import html from "./torrent-sidebar-section.template.html";

export class TorrentSidebarSectionController {
    items: string[] = [];
    active?: string;
    title = "";
    clearRole = "";
    emptyText = "";
    itemAttribute = "";
    onSelect?: (locals: { item?: string }) => void;

    isActive(item: string) {
        return this.active === item;
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
