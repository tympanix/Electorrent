import { IWindowService } from "angular";

export interface SortingOptions {
    defaultSortKey?: string;
    defaultSortOrder?: boolean;
    sortKeyPrefix?: string;
    sortOrderPrefix?: string;
}

const DEFAULT_SORT_KEY = "dateAdded";
const DEFAULT_SORT_ORDER = true;
const DEFAULT_SORT_KEY_PREFIX = "sort_key";
const DEFAULT_SORT_ORDER_PREFIX = "sort_desc";

function getStorageKey(prefix: string, mode: string) {
    return `${prefix}.${mode}`;
}

export function loadSortingState($window: IWindowService, mode: string, options: SortingOptions = {}) {
    const defaultSortKey = options.defaultSortKey || DEFAULT_SORT_KEY;
    const defaultSortOrder = options.defaultSortOrder ?? DEFAULT_SORT_ORDER;
    const sortKeyPrefix = options.sortKeyPrefix || DEFAULT_SORT_KEY_PREFIX;
    const sortOrderPrefix = options.sortOrderPrefix || DEFAULT_SORT_ORDER_PREFIX;
    const sortKey = $window.localStorage.getItem(getStorageKey(sortKeyPrefix, mode));
    const sortOrder = $window.localStorage.getItem(getStorageKey(sortOrderPrefix, mode));

    return {
        sortKey: sortKey && typeof sortKey === "string" ? sortKey : defaultSortKey,
        sortOrder: sortOrder ? sortOrder === "true" : defaultSortOrder,
    };
}

export function saveSortingState(
    $window: IWindowService,
    mode: string,
    key: string,
    order: boolean,
    options: SortingOptions = {},
) {
    const sortKeyPrefix = options.sortKeyPrefix || DEFAULT_SORT_KEY_PREFIX;
    const sortOrderPrefix = options.sortOrderPrefix || DEFAULT_SORT_ORDER_PREFIX;

    $window.localStorage.setItem(getStorageKey(sortKeyPrefix, mode), key);
    $window.localStorage.setItem(getStorageKey(sortOrderPrefix, mode), String(order));
}

export class SortingController {
    static $inject = ["$window"];

    mode!: string;
    defaultSortKey?: string;
    defaultSortOrder?: boolean;
    sortKeyPrefix?: string;
    sortOrderPrefix?: string;
    sorting!: (sortKey: string, descending: boolean) => void;
    sortKey!: string;
    sortOrder!: boolean;
    last?: JQuery;

    constructor(private $window: IWindowService) {}

    $onInit() {
        this.updateSettings();
    }

    updateSettings() {
        const { sortKey, sortOrder } = loadSortingState(this.$window, this.mode, this.getOptions());

        this.sortKey = sortKey;
        this.sortOrder = sortOrder;
    }

    save(key: string, order: boolean) {
        saveSortingState(this.$window, this.mode, key, order, this.getOptions());
    }

    private getOptions(): SortingOptions {
        return {
            defaultSortKey: this.defaultSortKey,
            defaultSortOrder: this.defaultSortOrder,
            sortKeyPrefix: this.sortKeyPrefix,
            sortOrderPrefix: this.sortOrderPrefix,
        };
    }
}
