interface StorageWindow {
    localStorage: Storage;
}

export interface SortingOptions {
    defaultSortKey?: string;
    defaultSortOrder?: boolean;
    sortKeyPrefix?: string;
    sortOrderPrefix?: string;
}

export interface SortChange<TSortKey = string> {
    sortKey: TSortKey;
    descending: boolean;
}

const DEFAULT_SORT_KEY = "dateAdded";
const DEFAULT_SORT_ORDER = true;
const DEFAULT_SORT_KEY_PREFIX = "sort_key";
const DEFAULT_SORT_ORDER_PREFIX = "sort_desc";

function getStorageKey(prefix: string, mode: string) {
    return `${prefix}.${mode}`;
}

export function loadSortingState($window: StorageWindow, mode: string, options: SortingOptions = {}) {
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
    $window: StorageWindow,
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
