import {
    AfterViewInit,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnChanges,
    OnDestroy,
    Output,
    ViewChild,
} from "@angular/core";
import marked from "marked";
import moment from "moment";

export interface UpdateModalData {
    releaseDate?: string | number | Date;
    releaseName?: string;
    releaseNotes?: string;
    updateUrl?: string;
    [key: string]: unknown;
}

export interface UpdateModalRef {
    showModal(): void;
    hideModal(): void;
    toggleModal(): void;
    refreshModal(): void;
}

export type UpdateModalAction = () => unknown;

@Component({
    selector: "update-modal",
    standalone: true,
    templateUrl: "./update-modal.template.html",
    exportAs: "updateModal",
})
export class UpdateModalComponent implements AfterViewInit, OnChanges, OnDestroy, UpdateModalRef {
    @Input() data: UpdateModalData = {};
    @Input() approve: UpdateModalAction = () => undefined;
    @Input() modalRef?: UpdateModalRef;
    @Output() readonly modalRefChange = new EventEmitter<UpdateModalRef | undefined>();

    @ViewChild("modal", { static: true }) private modalElement!: ElementRef<HTMLElement>;

    releaseNotesHtml = "";
    private modal?: JQuery;

    ngOnChanges(): void {
        this.releaseNotesHtml = marked(this.data.releaseNotes || "");
    }

    ngAfterViewInit(): void {
        const modal = $(this.modalElement.nativeElement);
        this.modal = modal;
        (modal as any).modal({
            onApprove: () => this.approve() !== false,
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

    formatReleaseDate(date: UpdateModalData["releaseDate"]): string {
        if (!date) return "Release date unknown";
        return typeof date === "string"
            ? moment(date, moment.ISO_8601, true).format("MMMM Do YYYY, HH:mm")
            : moment(date).format("MMMM Do YYYY, HH:mm");
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
export { UpdateModalComponent as UpdateModalDirective };
