import {
    AfterViewInit,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnDestroy,
    Output,
    ViewChild,
} from "@angular/core";

export interface InsecureTlsModalData {
    fingerprint?: string;
}

export interface InsecureTlsModalRef {
    showModal(): void;
    hideModal(): void;
    toggleModal(): void;
    refreshModal(): void;
}

export type InsecureTlsModalAction = () => unknown;
export type InsecureTlsModalAfter = (accepted: boolean) => unknown;

@Component({
    selector: "insecure-tls-modal",
    standalone: true,
    templateUrl: "./insecure-tls-modal.template.html",
    exportAs: "insecureTlsModal",
})
export class InsecureTlsModalComponent implements AfterViewInit, OnDestroy, InsecureTlsModalRef {
    @Input() data: InsecureTlsModalData = {};
    @Input() approve: InsecureTlsModalAction = () => undefined;
    @Input() after: InsecureTlsModalAfter = () => undefined;

    /** Supports Angular's `[(modalRef)]` replacement for `modal-ref`. */
    @Input() modalRef?: InsecureTlsModalRef;
    @Output() readonly modalRefChange = new EventEmitter<InsecureTlsModalRef | undefined>();

    @ViewChild("modal", { static: true }) private modalElement!: ElementRef<HTMLElement>;

    private modal?: JQuery;
    private accepted = false;

    ngAfterViewInit(): void {
        const modal = $(this.modalElement.nativeElement);
        this.modal = modal;
        (modal as any).modal({
            onDeny: () => {
                this.accepted = false;
                return true;
            },
            onApprove: () => {
                this.accepted = true;
                return this.approve() !== false;
            },
            onHidden: () => this.after(this.accepted),
            onShow: () => {
                this.accepted = false;
            },
            onVisible: () => (modal as any).modal("refresh"),
            closable: false,
            keyboardShortcuts: false,
            duration: 150,
        });

        this.modalRef = this;
        this.modalRefChange.emit(this);
    }

    ngOnDestroy(): void {
        if (this.modal) {
            (this.modal as any).modal("destroy");
        }
        this.modalRefChange.emit(undefined);
    }

    showModal(): void {
        if (this.modal) {
            (this.modal as any).modal("show");
        }
    }

    hideModal(): void {
        if (this.modal) {
            (this.modal as any).modal("hide");
        }
    }

    toggleModal(): void {
        if (this.modal) {
            (this.modal as any).modal("toggle");
        }
    }

    refreshModal(): void {
        if (this.modal) {
            (this.modal as any).modal("refresh");
        }
    }
}

// Transitional alias for imports that still use the old directive name.
export { InsecureTlsModalComponent as InsecureTlsModalDirective };
