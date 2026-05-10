import { IWindowService } from "angular";

export class SortingController {
    static $inject = ["$window"];

    mode!: string;
    sorting!: (sortKey: string, descending: boolean) => void;
    sortKey!: string;
    sortOrder!: boolean;
    last?: JQuery;

    constructor(private $window: IWindowService) {}

    $onInit() {
        this.updateSettings();
    }

    updateSettings() {
        this.sortKey = this.getSavedSortKey();
        this.sortOrder = this.getSavedSortOrder();
    }

    save(key: string, order: boolean) {
        this.$window.localStorage.setItem(`sort_key.${this.mode}`, key);
        this.$window.localStorage.setItem(`sort_desc.${this.mode}`, String(order));
    }

    private getSavedSortKey() {
        const sortKey = this.$window.localStorage.getItem(`sort_key.${this.mode}`);
        if (!sortKey || typeof sortKey !== "string") {
            return "dateAdded";
        }

        return sortKey;
    }

    private getSavedSortOrder() {
        const sortOrder = this.$window.localStorage.getItem(`sort_desc.${this.mode}`);
        if (!sortOrder) {
            return true;
        }

        return sortOrder === "true";
    }
}
