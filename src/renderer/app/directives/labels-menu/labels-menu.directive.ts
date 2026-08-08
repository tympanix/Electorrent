import {
    Component,
    EventEmitter,
    Input,
    Output,
} from "@angular/core"
import { CommonModule } from "@angular/common"
import { FormsModule } from "@angular/forms"
import { DropdownDirective } from "@renderer/app/directives/dropdown/dropdown.directive"
import { LabelChipDirective } from "@renderer/app/directives/label-chip/label-chip.directive"
import { NewLabelModalComponent } from "@renderer/app/directives/new-label-modal/new-label-modal.directive"

export interface LabelMenuSelection {
    create: boolean
    label: string
}

export type LabelsMenuAction = (label: string, create?: boolean) => void

@Component({
    selector: "labels-menu",
    standalone: true,
    imports: [CommonModule, FormsModule, DropdownDirective, LabelChipDirective, NewLabelModalComponent],
    templateUrl: "./labels-menu.template.html",
})
export class LabelsMenuDirective {
    @Input() enabled = false
    @Input() labels: string[] = []
    @Input() action?: LabelsMenuAction
    @Output() readonly labelSelected = new EventEmitter<LabelMenuSelection>()

    labelSearch = ""
    form = { label: "" }

    readonly approveNewLabel = () => {
        const label = this.form.label
        if (!label) {
            return false
        }

        this.selectLabel(label, true)
        this.form.label = ""
        return true
    }

    get filteredLabels() {
        const search = this.labelSearch.trim().toLocaleLowerCase()
        if (!search) {
            return this.labels
        }
        return this.labels.filter((label) => label.toLocaleLowerCase().includes(search))
    }

    selectLabel(label: string, create = false) {
        this.action?.(label, create)
        this.labelSelected.emit({ label, create })
    }

    openNewLabelModal() {
        const modal: any = $("#newLabelModal")
        modal.modal("show")
    }

    trackLabel(_index: number, label: string) {
        return label
    }
}

export { LabelsMenuDirective as LabelsMenuComponent }
