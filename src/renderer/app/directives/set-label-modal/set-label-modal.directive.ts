import { CommonModule } from "@angular/common";
import {
    AfterViewInit,
    Component,
    ElementRef,
    EventEmitter,
    Inject,
    Input,
    OnDestroy,
    Optional,
    Output,
    ViewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
    DropdownDirective,
    DropdownItemDirective,
} from "@renderer/app/directives/dropdown/dropdown.directive";
import { LabelChipDirective } from "@renderer/app/directives/label-chip/label-chip.directive";

interface SetLabelAction {
    type?: string;
    click?: (torrents: unknown[], label: string) => Promise<unknown> | unknown;
}

interface SetLabelClient {
    actionHeader?: SetLabelAction[];
}

interface SetLabelRootState {
    $btclient?: SetLabelClient | null;
}

interface NotificationService {
    alert(title: string, message: string): void;
}

export interface SetLabelModalRef {
    open(torrents: unknown[]): void;
    showModal(): void;
    hideModal(): void;
}

export type SetLabelSaved = () => Promise<void> | void;

@Component({
    selector: "set-label-modal",
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        DropdownDirective,
        DropdownItemDirective,
        LabelChipDirective,
    ],
    templateUrl: "./set-label-modal.template.html",
    exportAs: "setLabelModal",
})
export class SetLabelModalComponent implements AfterViewInit, OnDestroy, SetLabelModalRef {
    @Input() labels: string[] = [];
    @Input() onSaved?: SetLabelSaved;
    @Input() client?: SetLabelClient;
    @Input() modalRef?: SetLabelModalRef;
    @Output() readonly modalRefChange = new EventEmitter<SetLabelModalRef | undefined>();

    @ViewChild("modal", { static: true }) private modalElement!: ElementRef<HTMLElement>;

    label = "";
    torrents: unknown[] = [];
    private modal?: JQuery;

    constructor(
        @Optional() @Inject("$rootScope") private readonly rootState: SetLabelRootState | null,
        @Inject("notificationService") private readonly notifications: NotificationService,
    ) {}

    ngAfterViewInit(): void {
        const modal = $(this.modalElement.nativeElement);
        this.modal = modal;
        (modal as any).modal({
            onHidden: () => this.reset(),
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

    open(torrents: unknown[]): void {
        this.label = this.labels[0] || "";
        this.torrents = torrents.slice();
        this.showModal();
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

    submitOnEnter(event: KeyboardEvent): void {
        if (event.key !== "Enter") return;

        event.preventDefault();
        void this.apply();
    }

    async apply(): Promise<void> {
        if (!this.label || !this.torrents.length) return;

        const client = this.client || this.rootState?.$btclient;
        const labelAction = client?.actionHeader?.find((item) => item.type === "labels");
        if (!labelAction?.click || !client) return;

        try {
            await labelAction.click.call(client, this.torrents, this.label);
            await this.onSaved?.();
            this.hideModal();
        } catch (error) {
            console.error("Set label error", error);
            this.notifications.alert(
                "Invalid action",
                "The label could not be assigned because the server responded with a faulty reply",
            );
        }
    }

    private reset(): void {
        this.label = "";
        this.torrents = [];
    }
}

// Transitional alias for imports that still use the old directive name.
export { SetLabelModalComponent as SetLabelModalDirective };
