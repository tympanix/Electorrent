import {
    AfterViewInit,
    Directive,
    EventEmitter,
    Inject,
    NgZone,
    OnDestroy,
    Output,
} from "@angular/core"

interface ReadyEventBus {
    $emit(name: string, ...args: unknown[]): void
}

@Directive({
    selector: "[readyBroadcast], [ready-broadcast]",
    standalone: true,
})
export class ReadyBroadcastDirective implements AfterViewInit, OnDestroy {
    @Output() readonly rendererReady = new EventEmitter<void>()

    private readyTimer?: number

    constructor(
        @Inject("$rootScope") private readonly rootEvents: ReadyEventBus,
        private readonly zone: NgZone,
    ) {}

    ngAfterViewInit() {
        this.readyTimer = window.setTimeout(() => {
            this.readyTimer = undefined
            this.zone.run(() => {
                this.rootEvents.$emit("ready")
                this.rendererReady.emit()
            })
        }, 0)
    }

    ngOnDestroy() {
        if (this.readyTimer !== undefined) {
            window.clearTimeout(this.readyTimer)
            this.readyTimer = undefined
        }
    }
}
