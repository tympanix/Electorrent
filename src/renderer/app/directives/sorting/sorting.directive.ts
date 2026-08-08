import {
    booleanAttribute,
    Directive,
    ElementRef,
    EventEmitter,
    HostListener,
    inject,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    Output,
} from "@angular/core";
import {
    loadSortingState,
    saveSortingState,
    SortChange,
    SortingOptions,
} from "./sorting.controller";

interface SortHeader {
    readonly sortKey: string;
    setSortState(change: SortChange): void;
}

@Directive({
    selector: "[sorting]",
    standalone: true,
})
export class SortingDirective implements OnChanges, OnInit {
    @Input() mode = "";
    @Input() onSortChange?: (change: SortChange) => void;
    @Input() defaultSortKey?: string;
    @Input() defaultSortOrder?: boolean;
    @Input() sortKeyPrefix?: string;
    @Input() sortOrderPrefix?: string;
    @Output() readonly sortChange = new EventEmitter<SortChange>();

    private readonly headers = new Set<SortHeader>();
    private initialized = false;
    private state?: SortChange;

    ngOnInit(): void {
        this.initialized = true;
        this.loadState();
    }

    ngOnChanges(): void {
        if (this.initialized) {
            this.loadState();
        }
    }

    register(header: SortHeader): void {
        this.headers.add(header);
        if (!this.state) return;

        header.setSortState(this.state);
        if (header.sortKey === this.state.sortKey) {
            this.emitState();
        }
    }

    unregister(header: SortHeader): void {
        this.headers.delete(header);
    }

    select(sortKey: string): void {
        if (!this.state) return;

        const descending = this.state.sortKey === sortKey ? !this.state.descending : true;
        this.state = { sortKey, descending };
        saveSortingState(window, this.mode, sortKey, descending, this.options);
        this.renderState();
        this.emitState();
    }

    private loadState(): void {
        const { sortKey, sortOrder } = loadSortingState(window, this.mode, this.options);
        this.state = { sortKey, descending: sortOrder };
        this.renderState();
        if (Array.from(this.headers).some((header) => header.sortKey === sortKey)) {
            this.emitState();
        }
    }

    private renderState(): void {
        if (!this.state) return;
        this.headers.forEach((header) => header.setSortState(this.state!));
    }

    private emitState(): void {
        if (!this.state) return;
        this.onSortChange?.(this.state);
        this.sortChange.emit(this.state);
    }

    private get options(): SortingOptions {
        return {
            defaultSortKey: this.defaultSortKey,
            defaultSortOrder: this.defaultSortOrder,
            sortKeyPrefix: this.sortKeyPrefix,
            sortOrderPrefix: this.sortOrderPrefix,
        };
    }
}

@Directive({
    selector: "[sort-header], [sortHeader]",
    standalone: true,
})
export class SortHeaderDirective implements OnChanges, OnDestroy, OnInit, SortHeader {
    @Input() sortKey = "";
    @Input({ transform: booleanAttribute }) disabled = false;

    private readonly element: ElementRef<HTMLElement> = inject(ElementRef);
    private readonly sorting = inject(SortingDirective, { host: true });
    private currentState?: SortChange;
    private isDragging = false;

    ngOnInit(): void {
        this.sorting.register(this);
        this.render();
    }

    ngOnChanges(): void {
        this.render();
    }

    ngOnDestroy(): void {
        this.sorting.unregister(this);
        window.removeEventListener("mousemove", this.onWindowMouseMove);
    }

    setSortState(change: SortChange): void {
        this.currentState = change;
        this.render();
    }

    @HostListener("mousedown")
    onMouseDown(): void {
        if (this.disabled) return;

        this.isDragging = false;
        window.addEventListener("mousemove", this.onWindowMouseMove, { once: true });
    }

    @HostListener("mouseup")
    onMouseUp(): void {
        const wasDragging = this.isDragging;
        this.isDragging = false;
        window.removeEventListener("mousemove", this.onWindowMouseMove);
        if (!this.disabled && !wasDragging) {
            this.sorting.select(this.sortKey);
        }
    }

    private readonly onWindowMouseMove = () => {
        this.isDragging = true;
    };

    private render(): void {
        const column = this.element.nativeElement;
        const isActive = !this.disabled && this.currentState?.sortKey === this.sortKey;
        const descending = isActive && this.currentState?.descending === true;
        const icon = column.querySelector<HTMLElement>(":scope > .sorting.icon");

        if (this.disabled) {
            icon?.remove();
        } else if (!icon) {
            const newIcon = document.createElement("i");
            newIcon.className = "ui sorting icon";
            newIcon.setAttribute("aria-hidden", "true");
            column.append(newIcon);
        }

        column.classList.toggle("sorting-disabled", this.disabled);
        column.classList.toggle("sortdown", descending);
        column.classList.toggle("sortup", isActive && !descending);
        column.setAttribute("aria-disabled", String(this.disabled));
        column.setAttribute("aria-sort", isActive ? (descending ? "descending" : "ascending") : "none");
    }
}
