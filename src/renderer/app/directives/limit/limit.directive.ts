import {
    AfterViewInit,
    Directive,
    ElementRef,
    EventEmitter,
    HostListener,
    Input,
    OnChanges,
    OnDestroy,
    Output,
    booleanAttribute,
    inject,
} from "@angular/core";

const OVERFLOW_BUFFER_ROWS = 5;

interface LimitSourceMeasurement {
    readonly active: boolean;
    readonly element: HTMLElement;
    measureHeight(): number;
}

@Directive({
    selector: "[limitBind]",
    standalone: true,
})
export class LimitBindDirective implements OnChanges {
    @Input() limitBind = 0;
    @Output() limitBindChange = new EventEmitter<number>();

    private readonly container = inject(ElementRef<HTMLElement>);
    private readonly sources = new Set<LimitSourceMeasurement>();
    private elementHeight = 0;

    ngOnChanges(): void {
        this.updateLimit();
    }

    registerSource(source: LimitSourceMeasurement): void {
        const previousFirst = this.getFirstSource();
        this.sources.add(source);
        const nextFirst = this.getFirstSource();
        if (nextFirst && nextFirst !== previousFirst) {
            this.updateFromSource(nextFirst, true);
        }
    }

    sourceChanged(): void {
        this.updateFromFirstSource(true);
    }

    sourceRendered(source: LimitSourceMeasurement): void {
        if (this.getFirstSource() === source) {
            this.updateFromSource(source, true);
        }
    }

    unregisterSource(source: LimitSourceMeasurement): void {
        const wasFirst = this.getFirstSource() === source;
        this.sources.delete(source);
        if (wasFirst) {
            this.updateFromFirstSource(true);
        }
    }

    @HostListener("window:resize")
    updateOnResize(): void {
        this.updateLimit();
    }

    private updateFromFirstSource(force: boolean): void {
        const firstSource = this.getFirstSource();

        if (firstSource) {
            this.updateFromSource(firstSource, force);
        }
    }

    private getFirstSource(): LimitSourceMeasurement | undefined {
        return [...this.sources]
            .filter((source) => source.active && source.element.isConnected)
            .sort((left, right) => {
                const position = left.element.compareDocumentPosition(right.element);
                return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
            })[0];
    }

    private updateFromSource(source: LimitSourceMeasurement, force: boolean): void {
        this.elementHeight = source.measureHeight();
        this.updateLimit(force);
    }

    private updateLimit(force = false): void {
        if (!this.elementHeight) {
            return;
        }

        const visibleRows = Math.ceil(this.container.nativeElement.clientHeight / this.elementHeight);
        const nextLimit = visibleRows + OVERFLOW_BUFFER_ROWS;
        if (nextLimit > this.limitBind || force) {
            this.limitBind = nextLimit;
            this.limitBindChange.emit(nextLimit);
        }
    }
}

@Directive({
    selector: "[limitSource]",
    standalone: true,
})
export class LimitSourceDirective implements AfterViewInit, OnChanges, OnDestroy, LimitSourceMeasurement {
    @Input({ transform: booleanAttribute }) limitSource = true;

    private readonly limit = inject(LimitBindDirective);
    private readonly elementRef = inject(ElementRef<HTMLElement>);
    private initialized = false;
    private renderFrame?: number;

    get active(): boolean {
        return this.limitSource;
    }

    get element(): HTMLElement {
        return this.elementRef.nativeElement;
    }

    ngAfterViewInit(): void {
        this.initialized = true;
        this.limit.registerSource(this);
        this.renderFrame = window.requestAnimationFrame(() => this.limit.sourceRendered(this));
    }

    ngOnChanges(): void {
        if (this.initialized) {
            this.limit.sourceChanged();
        }
    }

    ngOnDestroy(): void {
        if (this.renderFrame !== undefined) {
            window.cancelAnimationFrame(this.renderFrame);
        }
        if (this.initialized) {
            this.limit.unregisterSource(this);
        }
    }

    measureHeight(): number {
        return this.elementRef.nativeElement.getBoundingClientRect().height;
    }
}
