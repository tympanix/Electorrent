import {
    AfterViewInit,
    Component,
    ElementRef,
    Input,
    OnDestroy,
    ViewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";

export interface NewLabelModalData {
    label: string;
}

export type NewLabelModalAction = () => unknown;

@Component({
    selector: "new-label-modal",
    standalone: true,
    imports: [FormsModule],
    templateUrl: "./new-label-modal.template.html",
    exportAs: "newLabelModal",
})
export class NewLabelModalComponent implements AfterViewInit, OnDestroy {
    @Input() data: NewLabelModalData = { label: "" };
    @Input() approve: NewLabelModalAction = () => undefined;

    @ViewChild("modal", { static: true }) private modalElement!: ElementRef<HTMLElement>;

    private modal?: JQuery;

    ngAfterViewInit(): void {
        const modal = $(this.modalElement.nativeElement);
        this.modal = modal;
        (modal as any).modal({
            onApprove: () => this.apply(),
            onVisible: () => (modal as any).modal("refresh"),
            closable: false,
            keyboardShortcuts: false,
            duration: 150,
        });
    }

    ngOnDestroy(): void {
        if (this.modal) {
            (this.modal as any).modal("destroy");
        }
    }

    applyAndClose(): void {
        if (this.apply()) {
            this.hideModal();
        }
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

    private apply(): boolean {
        return !!this.data.label && this.approve() !== false;
    }
}

// Transitional alias for imports that still use the old directive name.
export { NewLabelModalComponent as NewLabelModalDirective };
