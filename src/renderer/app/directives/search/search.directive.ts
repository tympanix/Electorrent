import {
    Directive,
    ElementRef,
    EventEmitter,
    HostListener,
    Inject,
    OnDestroy,
    OnInit,
    Output,
} from "@angular/core"

interface SearchEventBus {
    $on(name: string, callback: (...args: unknown[]) => void): () => void
}

@Directive({
    selector: "input[search]",
    standalone: true,
})
export class SearchDirective implements OnInit, OnDestroy {
    @Output() readonly searchActivated = new EventEmitter<void>()

    private unsubscribe: () => void = () => undefined

    constructor(
        private readonly element: ElementRef<HTMLInputElement>,
        @Inject("$rootScope") private readonly rootEvents: SearchEventBus,
    ) {}

    ngOnInit() {
        this.unsubscribe = this.rootEvents.$on("search:torrent", () => {
            const input = this.element.nativeElement
            input.focus()
            input.select()
            this.searchActivated.emit()
        })
    }

    ngOnDestroy() {
        this.unsubscribe()
    }

    @HostListener("keyup.escape")
    blurOnEscape() {
        this.element.nativeElement.blur()
    }
}
