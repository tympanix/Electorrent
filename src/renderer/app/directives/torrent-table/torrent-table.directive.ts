import { CommonModule } from "@angular/common";
import { Component, Directive, inject, Input } from "@angular/core";
import { LabelChipDirective } from "@renderer/app/directives/label-chip/label-chip.directive";
import { ProgressDirective } from "@renderer/app/directives/progress/progress.directive";
import { TimeDirective, TimeValue } from "@renderer/app/directives/time/time.directive";
import moment from "moment";

export interface TorrentTableColumn {
    attribute?: string;
    enabled?: boolean;
    name?: string;
    template?: string;
}

type CellKind = "label" | "progress" | "text" | "time";

const MONTH_IN_SECONDS = 60 * 60 * 24 * 30;

@Directive({
    selector: "[torrent-body], [torrentBody]",
    standalone: true,
})
export class TorrentBodyDirective {
    @Input() columns: TorrentTableColumn[] = [];

    get renderColumns(): TorrentTableColumn[] {
        return (this.columns || []).filter((column) => column.enabled);
    }
}

@Component({
    selector: "[torrent-row], [torrentRow]",
    standalone: true,
    imports: [CommonModule, LabelChipDirective, ProgressDirective, TimeDirective],
    templateUrl: "./torrent-table.template.html",
})
export class TorrentRowDirective {
    @Input() torrent: Record<string, any> = {};
    @Input() settings?: { ui?: { cleanNames?: boolean } };

    readonly body = inject(TorrentBodyDirective, { host: true });

    cellKind(column: TorrentTableColumn): CellKind {
        const template = column.template || "";
        if (template.includes(" progress=")) return "progress";
        if (template.includes('data-cell-kind="label"') || template.includes("label-chip=")) return "label";
        if (template.includes(" time=")) return "time";
        return "text";
    }

    columnValue(column: TorrentTableColumn): string {
        const template = column.template || "";
        if (!template) {
            return this.stringify(this.propertyValue(column.attribute));
        }

        return template.replace(/\{\{\s*(.*?)\s*\}\}/g, (_match, expression: string) => {
            return this.evaluateExpression(expression.trim());
        });
    }

    labelValue(column: TorrentTableColumn): string {
        return this.stringify(this.propertyValue(column.attribute || "label"));
    }

    timeValue(column: TorrentTableColumn): TimeValue {
        const value = this.propertyValue(column.attribute);
        return column.template?.includes("* 1000") ? Number(value) * 1000 : value as TimeValue;
    }

    trackColumn(_index: number, column: TorrentTableColumn): string {
        return column.attribute || column.name || String(_index);
    }

    private evaluateExpression(expression: string): string {
        if (expression.includes("settings.ui.cleanNames")) {
            return this.stringify(this.settings?.ui?.cleanNames ? this.torrent.decodedName : this.torrent.name);
        }

        const booleanMatch = expression.match(/^torrent\.(\w+)\s*\?\s*['"]Yes['"]\s*:\s*['"]No['"]$/);
        if (booleanMatch) {
            return this.torrent[booleanMatch[1]] ? "Yes" : "No";
        }

        const [source, filterExpression] = expression.split("|").map((part) => part.trim());
        const value = this.resolveSource(source);
        if (!filterExpression) return this.stringify(value);

        const [filter, argument] = filterExpression.split(":").map((part) => part.trim());
        switch (filter) {
            case "bytes": return this.formatBytes(value, argument ? Number(argument) : 1);
            case "speed": return `${this.formatBytes(value)}/s`;
            case "speedLimit": return this.formatSpeedLimit(value);
            case "eta": return this.formatEta(value);
            case "number": return this.formatNumber(value, argument);
            case "torrentQueue": return this.formatQueue(value);
            case "torrentRatio": return this.formatRatio(value);
            default: return this.stringify(value);
        }
    }

    private resolveSource(source: string): unknown {
        const method = source.match(/^torrent\.(\w+)\(\)$/);
        if (method) {
            const callback = this.torrent[method[1]];
            return typeof callback === "function" ? callback.call(this.torrent) : "";
        }

        const property = source.match(/^torrent\.(\w+)$/);
        return property ? this.torrent[property[1]] : "";
    }

    private propertyValue(attribute?: string): unknown {
        return attribute ? this.torrent[attribute] : "";
    }

    private stringify(value: unknown): string {
        return value === null || value === undefined ? "" : String(value);
    }

    private formatBytes(value: unknown, fractionSize = 1): string {
        if (value === null || value === undefined) return "";
        const bytes = Number(value);
        if (!Number.isFinite(bytes) || bytes < 0) return "";
        if (bytes === 0) return "0 B";

        const unit = 1024;
        const decimals = fractionSize < 0 ? 0 : fractionSize;
        const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
        const index = Math.floor(Math.log(bytes) / Math.log(unit));
        return `${parseFloat((bytes / Math.pow(unit, index)).toFixed(decimals))} ${sizes[index]}`;
    }

    private formatSpeedLimit(value: unknown): string {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return "";
        return numeric <= 0 ? "∞" : `${this.formatBytes(numeric)}/s`;
    }

    private formatEta(value: unknown): string {
        const seconds = Number(value);
        if (!seconds || seconds < 1 || seconds > MONTH_IN_SECONDS) return "";
        return moment().to(moment().add(seconds, "seconds"), true);
    }

    private formatNumber(value: unknown, fractionSize?: string): string {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return "";
        const digits = fractionSize === undefined ? undefined : Math.max(0, Number(fractionSize));
        return new Intl.NumberFormat("en-US", digits === undefined ? {
            maximumFractionDigits: 3,
        } : {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        }).format(numeric);
    }

    private formatQueue(value: unknown): string {
        const queue = Number(value);
        return Number.isInteger(queue) && queue >= 0 ? String(queue) : "";
    }

    private formatRatio(value: unknown): string {
        const ratio = Number(value);
        return Number.isFinite(ratio) && ratio >= 0 ? ratio.toFixed(2) : "";
    }
}
