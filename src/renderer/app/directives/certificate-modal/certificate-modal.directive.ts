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
import moment from "moment"
import type { CertificatePrompt } from "@shared/ipc-contract"

export interface CertificateModalRef {
    showModal: () => void
    hideModal: () => void
    toggleModal: () => void
    refreshModal: () => void
}

export type CertificateModalAfter = (accepted: boolean) => unknown
export type CertificateModalAction = () => unknown

const EMPTY_CERTIFICATE: CertificatePrompt = {
    source: "",
    selfSigned: false,
    issuer: {},
    subject: {},
    fingerprint: "",
    validFrom: 0,
    validTo: 0,
    serialNumber: "",
}

@Component({
    selector: "certificate-modal",
    standalone: true,
    imports: [CommonModule],
    templateUrl: "./certificate-modal.template.html",
    exportAs: "certificateModal",
})
export class CertificateModalDirective implements AfterViewInit, OnDestroy, CertificateModalRef {
    private certificateData: CertificatePrompt = EMPTY_CERTIFICATE

    @Input()
    set data(data: CertificatePrompt | null | undefined) {
        this.certificateData = data || EMPTY_CERTIFICATE
    }

    get data() {
        return this.certificateData
    }

    @Input() approve: CertificateModalAction = () => undefined
    @Input() allowInsecureTls: CertificateModalAction = () => undefined
    @Input() after: CertificateModalAfter = () => undefined

    /** Supports Angular's `[(modalRef)]` migration of the legacy `modal-ref` binding. */
    @Input() modalRef?: CertificateModalRef
    @Output() readonly modalRefChange = new EventEmitter<CertificateModalRef | undefined>()

    @ViewChild("modal", { static: true }) private modalElement!: ElementRef<HTMLElement>

    private modal?: JQuery
    private accepted = false

    ngAfterViewInit() {
        const modal = $(this.modalElement.nativeElement)
        this.modal = modal
        ;(modal as any).modal({
            onDeny: () => {
                this.accepted = false
                return true
            },
            onApprove: () => {
                this.accepted = true
                return this.approve() !== false
            },
            onHidden: () => this.after(this.accepted),
            onShow: () => {
                this.accepted = false
            },
            onVisible: () => (modal as any).modal("refresh"),
            closable: false,
            keyboardShortcuts: false,
            duration: 150,
        })

        this.modalRef = this
        this.modalRefChange.emit(this)
    }

    ngOnDestroy() {
        if (this.modal) {
            ;(this.modal as any).modal("destroy")
        }
        this.modalRefChange.emit(undefined)
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

    enableInsecureTls() {
        this.allowInsecureTls()
    }

    formatEpoch(value: number) {
        if (!value) {
            return "Unknown date"
        }
        return moment(value * 1000).format("MMMM Do YYYY, HH:mm")
    }
}

export { CertificateModalDirective as CertificateModalComponent }
