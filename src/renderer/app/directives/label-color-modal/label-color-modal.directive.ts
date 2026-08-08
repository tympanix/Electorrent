import {
    AfterViewInit,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnDestroy,
    Output,
    ViewChild,
} from "@angular/core"
import { CommonModule } from "@angular/common"
import { LABEL_COLOR_HUES } from "@renderer/app/services/label-colors"
import type { LabelColorHue } from "@shared/ipc-contract"

export interface LabelColorModalOpenOptions {
    currentHue?: LabelColorHue
    label: string
    onSelect?: (hue: LabelColorHue) => void
}

export interface LabelColorModalRef {
    open(options: LabelColorModalOpenOptions): void
    close(): void
}

@Component({
    selector: "label-color-modal",
    standalone: true,
    imports: [CommonModule],
    templateUrl: "./label-color-modal.template.html",
    exportAs: "labelColorModal",
})
export class LabelColorModalDirective implements AfterViewInit, OnDestroy, LabelColorModalRef {
    @Input() modalId = "labelColorModal"
    @Output() readonly modalRefChange = new EventEmitter<LabelColorModalRef | undefined>()
    @Output() readonly hueSelected = new EventEmitter<LabelColorHue>()

    @ViewChild("modal", { static: true }) private modalElement!: ElementRef<HTMLElement>

    readonly hues = LABEL_COLOR_HUES
    label = ""
    selectedHue: LabelColorHue = 220

    private modal?: JQuery
    private onSelect?: (hue: LabelColorHue) => void
    private openWhenReady = false

    ngAfterViewInit() {
        const modal = $(this.modalElement.nativeElement)
        this.modal = modal
        ;(modal as any).modal({
            onHidden: () => this.onHidden(),
            onVisible: () => (modal as any).modal("refresh"),
            closable: false,
            keyboardShortcuts: false,
            duration: 150,
        })
        this.modalRefChange.emit(this)

        if (this.openWhenReady) {
            this.openWhenReady = false
            this.showModal()
        }
    }

    ngOnDestroy() {
        if (this.modal) {
            ;(this.modal as any).modal("destroy")
        }
        this.modalRefChange.emit(undefined)
    }

    open(options: LabelColorModalOpenOptions) {
        this.label = options.label
        this.selectedHue = options.currentHue ?? 220
        this.onSelect = options.onSelect

        if (this.modal) {
            this.showModal()
        } else {
            this.openWhenReady = true
        }
    }

    close() {
        if (this.modal) {
            ;(this.modal as any).modal("hide")
        } else {
            this.openWhenReady = false
            this.onHidden()
        }
    }

    selectHue(hue: LabelColorHue) {
        this.selectedHue = hue
    }

    isSelected(hue: LabelColorHue) {
        return this.selectedHue === hue
    }

    getHueStyle(hue: LabelColorHue) {
        return String(hue)
    }

    save() {
        const hue = this.selectedHue
        this.onSelect?.(hue)
        this.hueSelected.emit(hue)
        this.close()
    }

    private showModal() {
        ;(this.modal as any).modal("show")
    }

    private onHidden() {
        this.label = ""
        this.selectedHue = 220
        this.onSelect = undefined
    }
}

export { LabelColorModalDirective as LabelColorModalComponent }
