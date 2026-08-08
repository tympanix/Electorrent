import {
    AfterViewInit,
    booleanAttribute,
    Component,
    ElementRef,
    EventEmitter,
    HostBinding,
    HostListener,
    Input,
    NgZone,
    OnDestroy,
    Output,
    Renderer2,
} from "@angular/core"

export type ModalAction = () => unknown
export type ModalAfterAction = (accepted: boolean) => unknown

export interface ModalRef {
    applyAndClose(): void
    showModal(): void
    hideModal(): void
    toggleModal(): void
    refreshModal(): void
}

@Component({
    selector: "modal",
    standalone: true,
    template: "<ng-content></ng-content>",
    exportAs: "modal",
})
export class ModalDirective implements AfterViewInit, OnDestroy, ModalRef {
    @HostBinding("class.ui") readonly uiClass = true
    @HostBinding("class.modal") readonly modalClass = true

    @Input({ transform: booleanAttribute }) closable = false
    @Input() approve?: ModalAction
    @Input() deny?: ModalAction
    @Input() after?: ModalAfterAction
    @Input() onHidden?: ModalAction
    @Input() hidden?: ModalAction
    @Input() onShow?: ModalAction
    @Input() show?: ModalAction
    @Input() modalRef?: ModalRef

    @Output() readonly modalRefChange = new EventEmitter<ModalRef | undefined>()
    @Output() readonly approved = new EventEmitter<void>()
    @Output() readonly denied = new EventEmitter<void>()
    @Output() readonly closed = new EventEmitter<boolean>()
    @Output() readonly visibilityChange = new EventEmitter<boolean>()

    private modal?: JQuery
    private accepted = false
    private sizeClass?: string

    constructor(
        private readonly element: ElementRef<HTMLElement>,
        private readonly renderer: Renderer2,
        private readonly zone: NgZone,
    ) {}

    @Input()
    set size(size: string | null | undefined) {
        if (this.sizeClass) {
            this.renderer.removeClass(this.element.nativeElement, this.sizeClass)
        }
        this.sizeClass = size || undefined
        if (this.sizeClass) {
            this.renderer.addClass(this.element.nativeElement, this.sizeClass)
        }
    }

    ngAfterViewInit() {
        const modal = $(this.element.nativeElement)
        this.modal = modal
        ;(modal as any).modal({
            onDeny: () => this.zone.run(() => {
                this.accepted = false
                this.denied.emit()
                return this.deny?.()
            }),
            onApprove: () => this.zone.run(() => {
                this.accepted = true
                this.approved.emit()
                return this.approve ? this.approve() : true
            }),
            onHidden: () => this.zone.run(() => {
                ModalDirective.clearForm(this.element.nativeElement)
                this.after?.(this.accepted)
                this.onHidden?.()
                this.hidden?.()
                this.closed.emit(this.accepted)
                this.visibilityChange.emit(false)
            }),
            onShow: () => this.zone.run(() => {
                this.accepted = false
                this.onShow?.()
                this.show?.()
                this.visibilityChange.emit(true)
            }),
            onVisible: () => (modal as any).modal("refresh"),
            closable: this.closable,
            keyboardShortcuts: false,
            duration: 150,
        })

        this.modalRef = this
        this.modalRefChange.emit(this)
    }

    ngOnDestroy() {
        if (this.modal) {
            ;(this.modal as any).modal("destroy")
            this.modal = undefined
        }
        this.modalRefChange.emit(undefined)
    }

    @HostListener("document:keydown", ["$event"])
    onDocumentKeyDown(event: KeyboardEvent) {
        if (event.key !== "Escape" || !this.modal || !(this.modal as any).modal("is active")) {
            return
        }

        event.preventDefault()
        this.hideModal()
    }

    applyAndClose() {
        if (!this.approve || this.approve() !== false) {
            this.accepted = true
            this.approved.emit()
            this.hideModal()
        } else {
            this.accepted = false
        }
    }

    showModal() {
        if (this.modal) {
            ;(this.modal as any).modal("show")
        }
    }

    hideModal() {
        if (this.modal) {
            ;(this.modal as any).modal("hide")
        }
    }

    toggleModal() {
        if (this.modal) {
            ;(this.modal as any).modal("toggle")
        }
    }

    refreshModal() {
        if (this.modal) {
            ;(this.modal as any).modal("refresh")
        }
    }

    static clearForm(element: HTMLElement) {
        const form: any = $(element)
        const angularControls = [
            "input",
            "select",
            "textarea",
            "[ngModel]",
            "[formControl]",
            "[formControlName]",
        ].join(",")
        if (!form.find(angularControls).length) {
            form.form("clear")
        }
        form.find(".error.message").empty()
    }
}

export { ModalDirective as ModalComponent }
