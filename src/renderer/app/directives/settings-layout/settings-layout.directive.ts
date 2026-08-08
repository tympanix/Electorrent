import { Component, EventEmitter, Input, Output } from "@angular/core"
import { CommonModule } from "@angular/common"
import type { ColumnProps } from "@renderer/app/services/column"

export interface SettingsLayoutServer {
    columns?: ColumnProps[]
}

export interface SettingsLayoutSortOptions {
    handle?: string
    "ui-floating"?: boolean
}

@Component({
    selector: "settings-layout",
    standalone: true,
    imports: [CommonModule],
    templateUrl: "./settings-layout.template.html",
})
export class SettingsLayoutDirective {
    @Input() server: SettingsLayoutServer = {}
    @Input() sortOptions?: SettingsLayoutSortOptions
    @Output() readonly serverChange = new EventEmitter<SettingsLayoutServer>()
    @Output() readonly columnsChange = new EventEmitter<ColumnProps[]>()

    draggingIndex: number | null = null

    get columns() {
        return Array.isArray(this.server?.columns) ? this.server.columns : []
    }

    setColumnEnabled(column: ColumnProps, enabled: boolean) {
        column.enabled = enabled
        this.emitColumnsChanged()
    }

    startColumnDrag(index: number, event: DragEvent) {
        this.draggingIndex = index
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move"
            event.dataTransfer.setData("text/plain", String(index))
        }
    }

    allowColumnDrop(event: DragEvent) {
        if (this.draggingIndex === null) {
            return
        }
        event.preventDefault()
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = "move"
        }
    }

    dropColumn(targetIndex: number, event: DragEvent) {
        event.preventDefault()
        const sourceIndex = this.draggingIndex
        this.draggingIndex = null
        if (sourceIndex === null || sourceIndex === targetIndex) {
            return
        }

        const columns = this.columns
        const [column] = columns.splice(sourceIndex, 1)
        if (!column) {
            return
        }
        columns.splice(targetIndex, 0, column)
        this.emitColumnsChanged()
    }

    finishColumnDrag() {
        this.draggingIndex = null
    }

    trackColumn(_index: number, column: ColumnProps) {
        return column
    }

    private emitColumnsChanged() {
        this.columnsChange.emit(this.columns)
        this.serverChange.emit(this.server)
    }
}

export { SettingsLayoutDirective as SettingsLayoutComponent }
