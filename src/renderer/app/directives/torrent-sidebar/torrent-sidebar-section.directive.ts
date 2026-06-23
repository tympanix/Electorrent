import { IDirective, IDirectiveFactory } from "angular";
import html from "./torrent-sidebar-section.template.html";

export class TorrentSidebarSectionController {
    items: string[] = [];
    active?: string;
    title = "";
    clearRole = "";
    emptyText = "";
    itemAttribute = "";
    labelColorStyle?: (label: string) => Record<string, string>;
    onSelect?: (locals: { item?: string }) => void;

    itemStyle(item: string) {
        return this.itemAttribute === "label" && this.labelColorStyle ? this.labelColorStyle(item) : {};
    }

    isActive(item: string) {
        return this.active === item;
    }

    select(item: string) {
        this.onSelect?.({ item });
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
        labelColorStyle: "=?",
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
