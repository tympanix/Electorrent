import {
    AfterViewInit,
    Component,
    EventEmitter,
    Input,
    OnDestroy,
    Output,
    ViewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ModalDirective, type ModalAction } from "@renderer/app/directives/modal/modal.directive";

export interface RenameServerItem {
    getDisplayName(): string;
}

export interface RenameServerModalData {
    server?: RenameServerItem;
    name: string;
    reset(): void;
}

@Component({
    selector: "rename-server-modal",
    standalone: true,
    imports: [FormsModule, ModalDirective],
    templateUrl: "./rename-server-modal.template.html",
})
export class RenameServerModalDirective implements AfterViewInit, OnDestroy {
    @Input() data: RenameServerModalData = {
        name: "",
        reset: () => undefined,
    };
    @Input() approve?: ModalAction;
    @Input() modalRef?: RenameServerModalDirective;
    @Output() readonly modalRefChange = new EventEmitter<RenameServerModalDirective | undefined>();

    @ViewChild(ModalDirective) private modal?: ModalDirective;

    ngAfterViewInit(): void {
        this.modalRef = this;
        this.modalRefChange.emit(this);
    }

    ngOnDestroy(): void {
        this.modalRefChange.emit(undefined);
    }

    open(server: RenameServerItem): void {
        this.data.server = server;
        this.data.name = server.getDisplayName();
        this.modal?.showModal();
    }
}

export { RenameServerModalDirective as RenameServerModalComponent };
