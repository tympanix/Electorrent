import {
    AfterViewInit,
    Directive,
    EventEmitter,
    Input,
    OnChanges,
    OnDestroy,
    Output,
    SimpleChanges,
} from "@angular/core"

export type RepeatDoneCallback = () => void

@Directive({
    selector: "[repeatDone], [repeat-done]",
    standalone: true,
})
export class RepeatDoneDirective implements AfterViewInit, OnChanges, OnDestroy {
    @Input() repeatDone?: RepeatDoneCallback | null
    @Input() repeatDoneLast = true
    @Output() readonly repeatCompleted = new EventEmitter<void>()

    private viewInitialized = false
    private callbackTimer?: number
    private invoked = false

    ngAfterViewInit() {
        this.viewInitialized = true
        this.scheduleCallback()
    }

    ngOnChanges(changes: SimpleChanges) {
        if (!this.viewInitialized) {
            return
        }

        if (changes.repeatDoneLast?.currentValue === false) {
            this.cancelCallback()
            this.invoked = false
            return
        }

        if (changes.repeatDone || changes.repeatDoneLast) {
            this.scheduleCallback()
        }
    }

    ngOnDestroy() {
        this.cancelCallback()
    }

    private scheduleCallback() {
        if (this.invoked || this.callbackTimer !== undefined || !this.repeatDoneLast) {
            return
        }
        if (typeof this.repeatDone !== "function") {
            return
        }

        this.callbackTimer = window.setTimeout(() => {
            this.callbackTimer = undefined
            if (!this.repeatDoneLast || typeof this.repeatDone !== "function") {
                return
            }

            this.invoked = true
            this.repeatDone()
            this.repeatCompleted.emit()
        }, 0)
    }

    private cancelCallback() {
        if (this.callbackTimer !== undefined) {
            window.clearTimeout(this.callbackTimer)
            this.callbackTimer = undefined
        }
    }
}
