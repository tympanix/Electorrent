import {
    Directive,
    ElementRef,
    EventEmitter,
    Input,
    OnDestroy,
    Output,
    Renderer2,
} from "@angular/core"
import moment from "moment"

export type TimeValue = number | string | Date | null | undefined

const BITTORRENT_EPOCH = 994_032_000_000
const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

@Directive({
    selector: "[time]",
    standalone: true,
})
export class TimeDirective implements OnDestroy {
    @Output() readonly timeRendered = new EventEmitter<string>()

    private value: TimeValue
    private timer?: number

    constructor(
        private readonly element: ElementRef<HTMLElement>,
        private readonly renderer: Renderer2,
    ) {}

    @Input()
    set time(value: TimeValue) {
        this.value = value
        this.restartTimer()
    }

    get time() {
        return this.value
    }

    ngOnDestroy() {
        this.cancelTimer()
    }

    private restartTimer() {
        this.cancelTimer()
        this.renderTime()
        this.scheduleUpdate()
    }

    private renderTime() {
        const text = this.formatTime(this.value)
        this.renderer.setProperty(this.element.nativeElement, "textContent", text)
        this.timeRendered.emit(text)
    }

    private formatTime(value: TimeValue) {
        const epochTime = value instanceof Date
            ? value.getTime()
            : typeof value === "number"
                ? value
                : Number(value)

        if (!epochTime || epochTime < BITTORRENT_EPOCH) {
            return ""
        }

        return moment(epochTime).fromNow()
    }

    private scheduleUpdate() {
        const delay = this.getNextUpdateDelay(this.value)
        if (delay === undefined) {
            return
        }

        this.timer = window.setTimeout(() => {
            this.timer = undefined
            this.renderTime()
            this.scheduleUpdate()
        }, delay)
    }

    private getNextUpdateDelay(value: TimeValue) {
        const timestamp = value instanceof Date
            ? value.getTime()
            : new Date(value as string | number).getTime()
        if (!Number.isFinite(timestamp)) {
            return undefined
        }

        const difference = Math.abs(Date.now() - timestamp)
        if (difference > DAY) {
            return undefined
        }
        if (difference < HOUR) {
            return MINUTE
        }
        if (difference < 6 * HOUR) {
            return 15 * MINUTE
        }
        return 30 * MINUTE
    }

    private cancelTimer() {
        if (this.timer !== undefined) {
            window.clearTimeout(this.timer)
            this.timer = undefined
        }
    }
}
