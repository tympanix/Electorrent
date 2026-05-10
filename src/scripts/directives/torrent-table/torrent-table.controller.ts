import { ICompileService, IScope } from "angular";

export class TorrentBodyController {
    static $inject = ["$compile"];

    columns: any[] = [];
    $template = "";
    $renderColumns: any[] = [];
    $rows: Array<{ render: () => void }> = [];
    $link: (scope: IScope, cloneAttachFn?: (clonedElement: JQuery) => void) => JQuery;

    constructor(private $compile: ICompileService) {
        this.$link = () => $();
    }

    subscribe(row: { render: () => void }) {
        this.$rows.push(row);
    }

    renderTemplate() {
        if (!this.columns) {
            return;
        }

        this.$renderColumns = this.columns.filter((column) => column.enabled);
        this.$template = this.$renderColumns
            .map((column) => `<td data-col="${column.attribute}">${column.template}</td>`)
            .join("");
        this.$link = this.$compile(this.$template);
    }

    render() {
        this.renderTemplate();
        this.$rows.forEach((row) => {
            row.render();
        });
    }
}
