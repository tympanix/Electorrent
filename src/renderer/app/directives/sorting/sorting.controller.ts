import { IAugmentedJQuery, IWindowService } from "angular";

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

export interface SortHeader {
    readonly sortKey: string;
    setSortState(change: SortChange): void;
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
    onSortChange?: (locals: { $event: SortChange }) => void;

    private readonly headers = new Set<SortHeader>();
    private initialized = false;
    private state!: SortChange;

    constructor(private $window: IWindowService) {}

    $onInit() {
        this.initialized = true;
        this.loadState();
    }

    $onChanges() {
        if (this.initialized) {
            this.loadState();
        }
    }

    register(header: SortHeader) {
        this.headers.add(header);
        if (this.state) {
            header.setSortState(this.state);
            if (header.sortKey === this.state.sortKey) {
                this.emitState();
            }
        }
    }

    unregister(header: SortHeader) {
        this.headers.delete(header);
    }

    select(sortKey: string) {
        const descending = this.state.sortKey === sortKey ? !this.state.descending : true;
        this.state = { sortKey, descending };
        saveSortingState(this.$window, this.mode, sortKey, descending, this.getOptions());
        this.renderState();
        this.emitState();
    }

    private loadState() {
        const { sortKey, sortOrder } = loadSortingState(this.$window, this.mode, this.getOptions());
        this.state = { sortKey, descending: sortOrder };
        this.renderState();
        if (Array.from(this.headers).some((header) => header.sortKey === sortKey)) {
            this.emitState();
        }
    }

    private renderState() {
        this.headers.forEach((header) => header.setSortState(this.state));
    }

    private emitState() {
        this.onSortChange?.({ $event: this.state });
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

export class SortHeaderController implements SortHeader {
    static $inject = ["$element", "$window"];

    sortKey!: string;
    disabled?: boolean;

    private sorting?: SortingController;
    private currentState?: SortChange;
    private isDragging = false;
    private readonly column: JQuery;
    private readonly windowElement: JQuery<IWindowService>;

    constructor($element: IAugmentedJQuery, $window: IWindowService) {
        this.column = $($element);
        this.windowElement = $($window);
    }

    $onInit() {
        this.column.on("mousedown", this.onMouseDown);
        this.column.on("mouseup", this.onMouseUp);
        this.render();
    }

    $onDestroy() {
        this.sorting?.unregister(this);
        this.column.off("mousedown", this.onMouseDown);
        this.column.off("mouseup", this.onMouseUp);
        this.windowElement.off("mousemove", this.onWindowMouseMove);
    }

    connect(sorting: SortingController) {
        this.sorting = sorting;
        sorting.register(this);
    }

    setInputs(sortKey: string, disabled: boolean) {
        this.sortKey = sortKey;
        this.disabled = disabled;
        this.render();
    }

    setSortState(change: SortChange) {
        this.currentState = change;
        this.render();
    }

    private readonly onMouseDown = () => {
        if (this.disabled) {
            return;
        }
        this.isDragging = false;
        this.windowElement.one("mousemove", this.onWindowMouseMove);
    };

    private readonly onWindowMouseMove = () => {
        this.isDragging = true;
    };

    private readonly onMouseUp = () => {
        const wasDragging = this.isDragging;
        this.isDragging = false;
        this.windowElement.off("mousemove", this.onWindowMouseMove);
        if (!this.disabled && !wasDragging) {
            this.sorting?.select(this.sortKey);
        }
    };

    private render() {
        const isActive = !this.disabled && this.currentState?.sortKey === this.sortKey;
        const descending = isActive && this.currentState?.descending === true;
        const icon = this.column.children(".sorting.icon");

        if (this.disabled) {
            icon.remove();
        } else if (!icon.length) {
            this.column.append('<i class="ui sorting icon" aria-hidden="true"></i>');
        }

        this.column.toggleClass("sorting-disabled", this.disabled === true);
        this.column.toggleClass("sortdown", descending);
        this.column.toggleClass("sortup", isActive && !descending);
        this.column.attr("aria-disabled", this.disabled === true ? "true" : "false");
        this.column.attr("aria-sort", isActive ? (descending ? "descending" : "ascending") : "none");
    }
}
